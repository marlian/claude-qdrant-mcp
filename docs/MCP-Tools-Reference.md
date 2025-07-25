# MCP Tools Reference - Qdrant RAG

> Complete reference for all available MCP tools in the Qdrant RAG system

## Overview

The Qdrant MCP Hybrid system provides four main tools for semantic search across your document collections:

- **`collection_info`** - Get system status and collection statistics
- **`catalog_search`** - Search document summaries within a specific client
- **`chunks_search`** - Search document chunks within a specific client  
- **`all_chunks_search`** - Search across all clients and collections

---

## collection_info

**Purpose:** Get system status and collection statistics

```typescript
qdrant-rag:collection_info
```

### Parameters
- **None required**

### Returns
- ✅ Total collections count
- ✅ Active client list
- ✅ Collection statistics (document counts per client)

### Example Response
```json
{
  "total_collections": 8,
  "active_clients": ["work", "personal", "research", "projects"],
  "collections": [
    {"name": "work_catalog", "points": 150},
    {"name": "work_chunks", "points": 1200},
    {"name": "personal_catalog", "points": 89},
    {"name": "personal_chunks", "points": 650}
  ]
}
```

### Use Cases
- Check system health
- Verify client setup
- Monitor collection sizes
- Debug connection issues

---

## catalog_search

**Purpose:** Search document summaries within a specific client

```typescript
qdrant-rag:catalog_search
```

### Parameters
- **`query`** (string, required) - Search query text
- **`client`** (string, required) - Client name to search within
- **`limit`** (number, optional) - Max results to return (default: 10)

### Example Usage
```json
{
  "query": "quarterly business strategy planning",
  "client": "work",
  "limit": 5
}
```

### Returns
- ✅ Document overviews/summaries ranked by relevance
- ✅ Source file paths
- ✅ Similarity scores
- ✅ Document metadata

### Example Response
```json
{
  "results": [
    {
      "score": 0.87,
      "source": "/work/documents/q4-strategy.md",
      "overview": "Comprehensive Q4 business strategy document covering market analysis, competitive positioning, and revenue targets for the upcoming quarter.",
      "metadata": {
        "hash": "abc123...",
        "created_at": "2024-01-15T10:30:00Z"
      }
    }
  ]
}
```

### Use Cases
- **Document discovery** - Find relevant documents by topic
- **Content overview** - Get high-level summaries before diving deep
- **Research starting point** - Identify key documents for further investigation

---

## chunks_search

**Purpose:** Search specific content chunks within a client's documents

```typescript
qdrant-rag:chunks_search
```

### Parameters
- **`query`** (string, required) - Search query text
- **`client`** (string, required) - Client name to search within
- **`limit`** (number, optional) - Max results to return (default: 10)
- **`source`** (string, optional) - Filter by specific document path

### Example Usage
```json
{
  "query": "database optimization performance tuning",
  "client": "research",
  "limit": 3
}
```

### Advanced Usage with Source Filter
```json
{
  "query": "implementation details",
  "client": "projects",
  "source": "/projects/api-redesign/technical-specs.md",
  "limit": 5
}
```

### Returns
- ✅ Detailed content chunks ranked by relevance
- ✅ Source file paths
- ✅ Chunk index within document
- ✅ Similarity scores
- ✅ Full context content

### Example Response
```json
{
  "results": [
    {
      "score": 0.92,
      "source": "/research/database-performance.md",
      "chunk_content": "Database performance can be significantly improved through proper indexing strategies. B-tree indexes are most effective for range queries, while hash indexes excel for equality lookups...",
      "chunk_index": 3,
      "chunk_total": 15,
      "metadata": {
        "hash": "def456...",
        "created_at": "2024-01-20T14:15:00Z"
      }
    }
  ]
}
```

### Use Cases
- **Detailed research** - Find specific information within documents
- **Code examples** - Locate implementation details or snippets
- **Fact checking** - Verify specific claims or data points
- **Citation gathering** - Find exact quotes or references

### ⚠️ Important Notes
- **DO NOT use `source` parameter incorrectly** - it can cause Bad Request errors
- **Source paths must be exact matches** - use catalog_search first to find correct paths
- **Chunk content is more granular** than catalog summaries

---

## all_chunks_search

**Purpose:** Search across all clients and collections simultaneously

```typescript
qdrant-rag:all_chunks_search
```

### Parameters
- **`query`** (string, required) - Search query text
- **`limit`** (number, optional) - Max results to return (default: 10)

### Example Usage
```json
{
  "query": "machine learning best practices",
  "limit": 20
}
```

### Returns
- ✅ Chunks from ALL clients ranked by relevance
- ✅ Client identification for each result
- ✅ Source file paths across all collections
- ✅ Mixed content from different domains

### Example Response
```json
{
  "results": [
    {
      "score": 0.89,
      "client": "research",
      "source": "/research/ml-practices.md",
      "chunk_content": "Cross-validation is essential for robust ML model evaluation..."
    },
    {
      "score": 0.85,
      "client": "work",
      "source": "/work/projects/ai-integration.md", 
      "chunk_content": "When implementing ML in production, consider data drift monitoring..."
    },
    {
      "score": 0.82,
      "client": "personal",
      "source": "/personal/learning/ml-notes.md",
      "chunk_content": "Feature engineering often has more impact than algorithm choice..."
    }
  ]
}
```

### Use Cases
- **Cross-domain research** - Find connections across different projects
- **Knowledge discovery** - Uncover unexpected relationships
- **Comprehensive analysis** - Get broader perspective on topics
- **Serendipitous findings** - Discover relevant content you forgot you had

### Performance Notes
- **Slower than client-specific searches** - queries multiple collections
- **Higher memory usage** - processes larger result sets
- **Best for exploration** - when you need comprehensive coverage

---

## Best Practices

### Query Optimization
- **Be specific** - "database performance tuning" vs "database"
- **Use natural language** - the system understands context well
- **Try different phrasings** - semantic search handles synonyms
- **Start broad, then narrow** - use catalog_search → chunks_search workflow

### Client Organization
- **Logical separation** - organize by project, domain, or confidentiality
- **Consistent naming** - use clear, memorable client names
- **Regular maintenance** - remove outdated clients/collections

### Performance Tips
- **Use appropriate limits** - don't request more results than needed
- **Cache collection_info** - system status doesn't change frequently
- **Prefer client-specific searches** when possible - they're faster

### Error Handling
- **Always check collection_info first** - verify client exists
- **Handle empty results gracefully** - not all queries will match
- **Validate client names** - typos will cause "client not found" errors

---

## Common Patterns

### Document Discovery Workflow
```typescript
// 1. Check system status
collection_info()

// 2. Find relevant documents
catalog_search({
  query: "your topic",
  client: "your_client",
  limit: 5
})

// 3. Deep dive into specific documents
chunks_search({
  query: "specific question",
  client: "your_client", 
  source: "/path/from/step2",
  limit: 10
})
```

### Cross-Client Research Workflow
```typescript
// 1. Broad search across all clients
all_chunks_search({
  query: "your research topic",
  limit: 15
})

// 2. Follow up in specific clients that showed promising results
chunks_search({
  query: "refined query",
  client: "promising_client_from_step1",
  limit: 5
})
```

### System Health Check
```typescript
// Regular monitoring
collection_info()
// Check for:
// - Expected number of collections
// - Reasonable document counts
// - All clients present
```

---

## Troubleshooting

### "Client not found" Error
- Check spelling of client name
- Verify client exists with `collection_info`
- Ensure proper case sensitivity

### "Bad Request" Error
- Remove `source` parameter if present in chunks_search
- Check query string format
- Validate JSON parameter structure

### Empty Results
- Try broader query terms
- Check if documents exist in specified client
- Verify client has been seeded with documents

### Slow Performance
- Reduce `limit` parameter
- Use client-specific searches instead of `all_chunks_search`
- Check Qdrant server health

---

*This reference covers all MCP tools available in the Qdrant RAG Hybrid system. For setup and configuration, see the main README.md*
