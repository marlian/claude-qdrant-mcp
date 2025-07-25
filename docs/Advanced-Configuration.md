# Advanced Configuration Guide

> Advanced setup and customization options for power users

## Custom Client Configuration

### Environment Setup
Your `.env` file controls all client configurations:

```bash
# Define your clients (comma-separated, no spaces)
CLIENT_COLLECTIONS=work,personal,research,client_a,client_b

# Each client gets two collections automatically:
# - {client}_catalog (document summaries)
# - {client}_chunks (searchable content)
```

### Dynamic Client Creation
Clients are created automatically when you run seeding:

```bash
# This creates marketing_catalog + marketing_chunks if they don't exist
npm run seed -- --client marketing --filesdir /path/to/marketing/docs
```

## Performance Tuning

### LM Studio Optimization
```bash
# Increase concurrency for faster processing
CONCURRENCY=8           # Parallel embedding requests (default: 5)
BATCH_SIZE=15          # Embeddings per API call (default: 10)

# Chunk size affects search granularity vs performance
CHUNK_SIZE=800         # Larger chunks = fewer API calls (default: 500)
CHUNK_OVERLAP=20       # Overlap for context preservation (default: 10)
```

### Memory Management
```bash
# For large document sets
CONCURRENCY=3          # Reduce if running out of memory
BATCH_SIZE=5           # Smaller batches for stability

# For speed optimization
CONCURRENCY=10         # Increase if you have powerful hardware
BATCH_SIZE=20          # Larger batches for efficiency
```

## Multi-Environment Setup

### Development vs Production
```bash
# Development (.env.development)
QDRANT_URL=http://localhost:6333
CLIENT_COLLECTIONS=test,dev,staging

# Production (.env.production)
QDRANT_URL=https://your-qdrant-cloud.io
CLIENT_COLLECTIONS=prod_client_a,prod_client_b,prod_shared
```

### Multi-Tenant Architecture
```bash
# Tenant isolation via client prefixes
CLIENT_COLLECTIONS=tenant1_docs,tenant1_legal,tenant2_docs,tenant2_legal

# Or separate Qdrant instances per tenant
QDRANT_URL=https://tenant1.qdrant.io    # Tenant 1 instance
QDRANT_URL=https://tenant2.qdrant.io    # Tenant 2 instance
```

## Embedding Model Alternatives

### BGE Models
```bash
# BGE-M3 (default - best multilingual)
EMBEDDING_MODEL=text-embedding-finetuned-bge-m3
EMBEDDING_DIM=1024

# BGE-Large (English-focused, higher quality)
EMBEDDING_MODEL=bge-large-en-v1.5
EMBEDDING_DIM=1024

# BGE-Small (faster, lower memory)
EMBEDDING_MODEL=bge-small-en-v1.5
EMBEDDING_DIM=384
```

### Alternative Embedding Models
```bash
# Sentence Transformers
EMBEDDING_MODEL=all-MiniLM-L6-v2
EMBEDDING_DIM=384

# OpenAI-compatible models
EMBEDDING_MODEL=text-embedding-ada-002
EMBEDDING_DIM=1536
```

## Qdrant Configuration

### Local Qdrant with Docker
```bash
# Basic setup
docker run -p 6333:6333 qdrant/qdrant

# With persistence
docker run -p 6333:6333 -v $(pwd)/qdrant_storage:/qdrant/storage qdrant/qdrant

# With API key
docker run -p 6333:6333 -e QDRANT__SERVICE__API_KEY=your-secret-key qdrant/qdrant
```

### Qdrant Cloud
```bash
# Get your cluster URL and API key from https://cloud.qdrant.io
QDRANT_URL=https://xyz-123.eu-west-1.aws.cloud.qdrant.io:6333
QDRANT_API_KEY=your-cloud-api-key
```

### Collection Configuration
```bash
# Custom collection settings (advanced)
QDRANT_COLLECTION_CONFIG='{
  "vectors": {
    "size": 1024,
    "distance": "Cosine"
  },
  "optimizers_config": {
    "default_segment_number": 2
  },
  "hnsw_config": {
    "m": 16,
    "ef_construct": 100
  }
}'
```

## Custom Document Processing

### Supported File Types
- **PDF** - via pdf-parse
- **DOCX** - via mammoth
- **Markdown** - native parsing
- **TXT** - native parsing

### Adding New File Types
Extend `src/seed.ts` to support additional formats:

```typescript
// Example: Add CSV support
import Papa from 'papaparse';

function extractTextFromCSV(buffer: Buffer): string {
  const csv = Papa.parse(buffer.toString(), { header: true });
  return csv.data.map(row => Object.values(row).join(' ')).join('\n');
}
```

### Custom Text Processing
```typescript
// Example: Clean text before embedding
function preprocessText(text: string): string {
  return text
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .replace(/[^\w\s]/g, '')        // Remove special characters
    .toLowerCase()                   // Normalize case
    .trim();
}
```

## Monitoring & Logging

### Debug Mode
```bash
# Enable comprehensive logging
DEBUG=true npm run seed -- --client test --filesdir ./docs

# Logs show:
# - Document processing steps
# - Embedding generation
# - Qdrant API calls
# - Performance metrics
```

### Production Monitoring
```bash
# Log to file
npm run seed -- --client prod 2>&1 | tee -a processing.log

# Monitor Qdrant health
curl $QDRANT_URL/telemetry

# Check collection stats
curl $QDRANT_URL/collections
```

### Performance Metrics
```bash
# Track processing speed
time npm run seed -- --client test --filesdir ./large-dataset

# Monitor memory usage
/usr/bin/time -v npm run seed -- --client test --filesdir ./docs
```

## Security & Privacy

### Local-First Setup
```bash
# Everything runs locally - no external API calls
QDRANT_URL=http://localhost:6333      # Local Qdrant
LM_STUDIO_URL=http://127.0.0.1:1235   # Local LM Studio
# No OPENAI_API_KEY needed
```

### Network Security
```bash
# Restrict Qdrant access
QDRANT_URL=http://127.0.0.1:6333     # Localhost only

# Use HTTPS for production
QDRANT_URL=https://your-secure-qdrant.com
QDRANT_API_KEY=your-secure-key
```

### Data Encryption
```bash
# Use encrypted Qdrant storage
docker run -p 6333:6333 \
  -v $(pwd)/encrypted_storage:/qdrant/storage \
  -e QDRANT__STORAGE__ENCRYPTION_KEY=your-encryption-key \
  qdrant/qdrant
```

## Backup & Recovery

### Collection Backup
```bash
# Export collections
curl -X POST "$QDRANT_URL/collections/work_catalog/snapshots" \
  -H "api-key: $QDRANT_API_KEY"

# Download snapshot
curl "$QDRANT_URL/collections/work_catalog/snapshots/snapshot-2024-01-01.tar" \
  -H "api-key: $QDRANT_API_KEY" \
  -o backup.tar
```

### Disaster Recovery
```bash
# Restore from backup
curl -X PUT "$QDRANT_URL/collections/work_catalog/snapshots/restore" \
  -H "api-key: $QDRANT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"location": "backup.tar"}'

# Or re-seed from source documents
npm run seed -- --client work --filesdir /backup/work/docs --overwrite
```

## Integration Examples

### Custom Sync Script
```bash
#!/bin/bash
# Watch for file changes and auto-sync
fswatch /path/to/docs | while read file; do
  echo "File changed: $file"
  npm run seed -- --client auto --filesdir /path/to/docs
done
```

### API Wrapper
```python
# Python wrapper for MCP tools
import subprocess
import json

def rag_search(query, client=None, limit=10):
    if client:
        tool = "chunks_search"
        params = {"query": query, "client": client, "limit": limit}
    else:
        tool = "all_chunks_search" 
        params = {"query": query, "limit": limit}
    
    # Call MCP tool via subprocess
    result = subprocess.run([
        "node", "dist/index.js", tool, json.dumps(params)
    ], capture_output=True, text=True)
    
    return json.loads(result.stdout)
```

### Scheduled Updates
```bash
# Cron job for regular updates
# Add to crontab: crontab -e
0 2 * * * cd /path/to/qdrant-mcp-hybrid && npm run seed -- --client daily 2>&1 | logger
```

## Troubleshooting Advanced Issues

### Collection Corruption
```bash
# Delete and recreate corrupted collection
curl -X DELETE "$QDRANT_URL/collections/corrupted_collection" \
  -H "api-key: $QDRANT_API_KEY"

# Re-seed from source
npm run seed -- --client corrupted --filesdir /path/to/docs --overwrite
```

### Memory Issues
```bash
# Reduce memory usage
CONCURRENCY=1 BATCH_SIZE=1 npm run seed -- --client large --filesdir /huge/dataset

# Process in smaller chunks
find /huge/dataset -name "*.pdf" | head -100 | xargs -I {} cp {} /temp/batch1/
npm run seed -- --client large_batch1 --filesdir /temp/batch1
```

### Performance Debugging
```bash
# Profile LM Studio performance
curl -w "@curl-format.txt" -s -o /dev/null "$LM_STUDIO_URL/v1/models"

# Check Qdrant performance
curl -w "Total time: %{time_total}s\n" "$QDRANT_URL/collections"

# Monitor system resources
htop
iotop
```

---

*This guide covers advanced configuration options. For basic setup, see the main README.md*
