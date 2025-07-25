# Claude Desktop Integration Guide

> Complete setup guide for integrating Qdrant MCP Hybrid with Claude Desktop

## 🎯 Quick Setup

### 1. Find Your Configuration File

**macOS:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```bash
~/.config/Claude/claude_desktop_config.json
```

### 2. Add MCP Server Configuration

Edit your `claude_desktop_config.json` and add the qdrant-rag server:

```json
{
  "mcpServers": {
    "qdrant-rag": {
      "command": "node",
      "args": ["/absolute/path/to/qdrant-mcp-hybrid/dist/index.js"],
      "env": {
        "QDRANT_URL": "http://localhost:6333",
        "QDRANT_API_KEY": "your-api-key-if-cloud",
        "CLIENT_COLLECTIONS": "work,personal,research",
        "LM_STUDIO_URL": "http://127.0.0.1:1235",
        "EMBEDDING_MODEL": "text-embedding-finetuned-bge-m3",
        "LLM_MODEL": "qwen/qwen3-8b"
      }
    }
  }
}
```

### 3. Restart Claude Desktop

**Important:** You must restart Claude Desktop completely for changes to take effect.

- **macOS:** Cmd+Q then reopen
- **Windows:** Close and reopen application
- **Linux:** Kill process and restart

## 🛠️ Configuration Examples

### Basic Local Setup
```json
{
  "mcpServers": {
    "qdrant-rag": {
      "command": "node",
      "args": ["/Users/username/qdrant-mcp-hybrid/dist/index.js"],
      "env": {
        "QDRANT_URL": "http://localhost:6333",
        "CLIENT_COLLECTIONS": "personal,work"
      }
    }
  }
}
```

### Qdrant Cloud Setup
```json
{
  "mcpServers": {
    "qdrant-rag": {
      "command": "node",
      "args": ["/Users/username/qdrant-mcp-hybrid/dist/index.js"],
      "env": {
        "QDRANT_URL": "https://your-cluster.eu-west-1.aws.cloud.qdrant.io:6333",
        "QDRANT_API_KEY": "your-cloud-api-key",
        "CLIENT_COLLECTIONS": "client_a,client_b,personal"
      }
    }
  }
}
```

### Multiple MCP Servers with Context Switching

**🎯 Key Feature:** Claude Desktop automatically creates toggles for each MCP server, allowing you to enable/disable tools per conversation context.

#### Context-Separated Setup
```json
{
  "mcpServers": {
    "rag-medical": {
      "command": "node",
      "args": ["/path/to/qdrant-mcp-hybrid/dist/index.js"],
      "env": {
        "QDRANT_URL": "http://localhost:6333",
        "CLIENT_COLLECTIONS": "medical",
        "SERVER_NAME": "medical-rag"
      }
    },
    "rag-work": {
      "command": "node",
      "args": ["/path/to/qdrant-mcp-hybrid/dist/index.js"],
      "env": {
        "QDRANT_URL": "http://localhost:6333", 
        "CLIENT_COLLECTIONS": "work,projects",
        "SERVER_NAME": "work-rag"
      }
    },
    "rag-personal": {
      "command": "node",
      "args": ["/path/to/qdrant-mcp-hybrid/dist/index.js"],
      "env": {
        "QDRANT_URL": "http://localhost:6333",
        "CLIENT_COLLECTIONS": "personal,research",
        "SERVER_NAME": "personal-rag"
      }
    },
    "rag-all": {
      "command": "node",
      "args": ["/path/to/qdrant-mcp-hybrid/dist/index.js"],
      "env": {
        "QDRANT_URL": "http://localhost:6333",
        "CLIENT_COLLECTIONS": "medical,work,personal,research",
        "SERVER_NAME": "all-clients"
      }
    }
  }
}
```

#### How Context Switching Works

1. **Server List UI:** Claude Desktop shows all configured servers with toggle switches
2. **Per-Conversation Control:** Enable only relevant servers for each conversation
3. **Tool Granularity:** Each server exposes its own set of tools (catalog_search, chunks_search, etc.)
4. **Real-time Toggle:** No restart needed - toggle on/off during conversation

#### Example Workflows

**Medical/Therapy Context:**
- ✅ Enable: `rag-medical`
- ❌ Disable: `rag-work`, `rag-personal`, `rag-all`
- **Result:** Only medical-related documents are searchable

**Work Project Context:**
- ✅ Enable: `rag-work`
- ❌ Disable: `rag-medical`, `rag-personal`, `rag-all`  
- **Result:** Only work documents accessible, privacy maintained

**Research/Cross-Reference Context:**
- ✅ Enable: `rag-all`
- ❌ Disable: specific servers
- **Result:** Search across all clients for connections

**Development/Debug Context:**
- ✅ Enable: `rag-all`
- ✅ Enable: specific servers (for comparison)
- **Result:** Full system access for troubleshooting

#### Benefits

- **🔒 Privacy Isolation:** Prevent accidental cross-contamination between contexts
- **🎯 Cognitive Focus:** Only relevant tools available per conversation
- **⚡ Performance:** Smaller tool sets load faster
- **🔄 Flexibility:** Switch contexts mid-conversation if needed
- **🛠️ Development:** Keep monolithic server for debugging alongside specialized ones

## 🔍 Verification

### Check MCP Connection

After restarting Claude Desktop:

1. **Start a new conversation**
2. **Type:** "Can you check my RAG system status?"
3. **Claude should be able to use:** `collection_info` tool
4. **Expected response:** List of your collections and clients

### Test Search

Try a semantic search:
```
Search for "your topic" in my personal documents
```

Claude should use `catalog_search` or `chunks_search` automatically.

## 🚨 Troubleshooting

### "Tools not available" Error

**Cause:** MCP server not connected

**Solutions:**
1. **Check path:** Ensure absolute path to `dist/index.js` is correct
2. **Build project:** Run `npm run build` in project directory
3. **Restart Claude:** Complete restart required after config changes
4. **Check logs:** Look for Node.js errors in system logs

### "Connection failed" Error

**Cause:** Qdrant not accessible

**Solutions:**
1. **Local Qdrant:** Ensure Docker container is running
   ```bash
   docker run -p 6333:6333 qdrant/qdrant
   ```
2. **Cloud Qdrant:** Verify URL and API key
3. **Network:** Check firewall/proxy settings

### "No results found" Error

**Cause:** Collections not seeded

**Solutions:**
1. **Seed documents:** Run seeding process first
   ```bash
   npm run seed -- --client personal --filesdir /path/to/docs
   ```
2. **Check collections:** Use `collection_info` to verify data exists
3. **Client names:** Ensure `CLIENT_COLLECTIONS` matches seeded clients

### Environment Variables Not Working

**Cause:** Variables not properly set in config

**Solutions:**
1. **Absolute paths:** Use full paths for all file references
2. **Quotes:** Ensure string values are properly quoted
3. **Syntax:** Validate JSON syntax (use JSON validator)

## 🎯 Performance Tips

### Optimize for Speed
```json
{
  "env": {
    "CONCURRENCY": "3",
    "BATCH_SIZE": "5",
    "DEBUG": "false"
  }
}
```

### Multiple Client Separation
```json
{
  "mcpServers": {
    "qdrant-rag-sensitive": {
      "command": "node",
      "args": ["/path/to/qdrant-mcp-hybrid/dist/index.js"],
      "env": {
        "CLIENT_COLLECTIONS": "confidential,legal"
      }
    },
    "qdrant-rag-general": {
      "command": "node", 
      "args": ["/path/to/qdrant-mcp-hybrid/dist/index.js"],
      "env": {
        "CLIENT_COLLECTIONS": "general,research,public"
      }
    }
  }
}
```

## 📊 Monitoring

### Health Check Commands

Ask Claude to run these periodically:

- **"Check RAG system status"** → Uses `collection_info`
- **"How many documents in each client?"** → Collection statistics
- **"Test search for [topic]"** → Verify search functionality

### Log Analysis

Enable debug mode for detailed logging:
```json
{
  "env": {
    "DEBUG": "true"
  }
}
```

Then check Node.js logs for performance metrics and error details.

## 🔄 Updates and Maintenance

### Updating the System

1. **Pull latest code:** `git pull origin main`
2. **Rebuild:** `npm run build`
3. **Restart Claude Desktop:** Complete restart required
4. **Test functionality:** Run health checks

### Adding New Clients

1. **Update environment:** Add client to `CLIENT_COLLECTIONS`
2. **Seed documents:** Run seeding for new client
3. **Restart Claude Desktop:** For config changes
4. **Verify:** Use `collection_info` to confirm new collections

---

*For complete MCP tool documentation, see [MCP Tools Reference](MCP-Tools-Reference.md)*
