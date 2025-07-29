#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

console.log(chalk.cyan.bold('\n🚀 Claude Qdrant MCP Setup\n'));

// Check if this is a global install
const isGlobalInstall = !process.cwd().includes('node_modules');
const targetDir = isGlobalInstall ? process.cwd() : projectRoot;

async function checkDependencies() {
  console.log(chalk.yellow('📋 Checking system dependencies...\n'));
  
  const checks = [];
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  checks.push({
    name: 'Node.js (≥18)',
    status: majorVersion >= 18,
    current: nodeVersion,
    required: '≥18.0.0'
  });
  
  // Check if Qdrant is accessible
  try {
    const { default: axios } = await import('axios');
    await axios.get('http://localhost:6333/collections', { timeout: 3000 });
    checks.push({
      name: 'Qdrant Server',
      status: true,
      current: 'Running on localhost:6333',
      required: 'Required'
    });
  } catch {
    checks.push({
      name: 'Qdrant Server',
      status: false,
      current: 'Not running on localhost:6333',
      required: 'Required'
    });
  }
  
  // Check if LM Studio is accessible
  try {
    const { default: axios } = await import('axios');
    await axios.get('http://127.0.0.1:1235/v1/models', { timeout: 3000 });
    checks.push({
      name: 'LM Studio',
      status: true,
      current: 'Running on port 1235',
      required: 'Required'
    });
  } catch {
    checks.push({
      name: 'LM Studio',
      status: false,
      current: 'Not running on port 1235',
      required: 'Required'
    });
  }
  
  // Display results
  checks.forEach(check => {
    const icon = check.status ? '✅' : '❌';
    const color = check.status ? chalk.green : chalk.red;
    console.log(`${icon} ${color(check.name)}: ${check.current}`);
  });
  
  const allPassed = checks.every(check => check.status);
  
  if (!allPassed) {
    console.log(chalk.yellow('\n⚠️  Some dependencies are missing. Setup will continue, but you may need to:'));
    console.log(chalk.yellow('   • Install and start Qdrant (Docker: docker run -p 6333:6333 qdrant/qdrant)'));
    console.log(chalk.yellow('   • Install and start LM Studio with BGE-M3 and Qwen3 models'));
    console.log(chalk.yellow('   • See README.md for detailed setup instructions\n'));
  }
  
  return allPassed;
}

async function createConfig() {
  console.log(chalk.blue('🔧 Configuration Setup\n'));
  
  const envPath = path.join(targetDir, '.env');
  
  let useExisting = false;
  if (fs.existsSync(envPath)) {
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: '.env file already exists. Overwrite?',
      default: false
    }]);
    
    if (!overwrite) {
      console.log(chalk.green('✅ Using existing .env configuration'));
      return;
    }
  }
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'qdrantUrl',
      message: 'Qdrant URL:',
      default: 'http://localhost:6333'
    },
    {
      type: 'input',
      name: 'qdrantApiKey',
      message: 'Qdrant API Key (leave empty for local):',
      default: ''
    },
    {
      type: 'input',
      name: 'lmStudioUrl',
      message: 'LM Studio URL:',
      default: 'http://127.0.0.1:1235'
    },
    {
      type: 'input',
      name: 'embeddingModel',
      message: 'Embedding Model:',
      default: 'text-embedding-finetuned-bge-m3'
    },
    {
      type: 'input',
      name: 'llmModel',
      message: 'LLM Model:',
      default: 'qwen/qwen3-8b'
    },
    {
      type: 'input',
      name: 'clientCollections',
      message: 'Client Collections (comma-separated):',
      default: 'work,personal,research'
    }
  ]);
  
  const envContent = `# Qdrant Configuration
QDRANT_URL=${answers.qdrantUrl}
${answers.qdrantApiKey ? `QDRANT_API_KEY=${answers.qdrantApiKey}` : '# QDRANT_API_KEY=your-api-key-for-cloud'}

# LM Studio Configuration
LM_STUDIO_URL=${answers.lmStudioUrl}
EMBEDDING_MODEL=${answers.embeddingModel}
EMBEDDING_DIM=1024
LLM_MODEL=${answers.llmModel}

# Multi-Client Setup
CLIENT_COLLECTIONS=${answers.clientCollections}

# Performance Tuning
CONCURRENCY=5
BATCH_SIZE=10
CHUNK_SIZE=500
CHUNK_OVERLAP=10
DEBUG=false
`;
  
  fs.writeFileSync(envPath, envContent);
  console.log(chalk.green(`✅ Configuration saved to ${envPath}`));
}

async function setupClaudeDesktop() {
  console.log(chalk.blue('\n🤖 Claude Desktop Integration\n'));
  
  const { setupClaude } = await inquirer.prompt([{
    type: 'confirm',
    name: 'setupClaude',
    message: 'Configure Claude Desktop integration?',
    default: true
  }]);
  
  if (!setupClaude) return;
  
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const configPath = path.join(homeDir, '.config', 'claude-desktop', 'claude_desktop_config.json');
  const serverPath = path.join(targetDir, 'dist', 'index.js');
  
  // Ensure config directory exists
  fs.ensureDirSync(path.dirname(configPath));
  
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  Existing config file is malformed, creating new one'));
    }
  }
  
  if (!config.mcpServers) config.mcpServers = {};
  
  config.mcpServers['claude-qdrant-mcp'] = {
    command: 'node',
    args: [serverPath],
    env: {
      QDRANT_URL: process.env.QDRANT_URL || 'http://localhost:6333',
      LM_STUDIO_URL: process.env.LM_STUDIO_URL || 'http://127.0.0.1:1235',
      CLIENT_COLLECTIONS: process.env.CLIENT_COLLECTIONS || 'work,personal,research'
    }
  };
  
  if (process.env.QDRANT_API_KEY) {
    config.mcpServers['claude-qdrant-mcp'].env.QDRANT_API_KEY = process.env.QDRANT_API_KEY;
  }
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(chalk.green(`✅ Claude Desktop config updated: ${configPath}`));
  console.log(chalk.cyan('💡 Restart Claude Desktop to apply changes'));
}

async function generateSampleDocs() {
  const { createSample } = await inquirer.prompt([{
    type: 'confirm',
    name: 'createSample',
    message: 'Create sample documents for testing?',
    default: true
  }]);
  
  if (!createSample) return;
  
  const sampleDir = path.join(targetDir, 'sample-docs');
  fs.ensureDirSync(sampleDir);
  
  const sampleDocs = [
    {
      name: 'project-overview.md',
      content: `# Project Overview

## Goal
Create an advanced RAG system with multi-client isolation and semantic search capabilities.

## Features
- Qdrant vector database integration
- LM Studio for local embeddings and summaries
- Multi-tenant architecture with client isolation
- Advanced document processing pipeline

## Technologies
- TypeScript for type safety
- Langchain for document processing
- BGE-M3 for embeddings
- Qwen3 for summaries
`
    },
    {
      name: 'technical-notes.md',
      content: `# Technical Implementation Notes

## Architecture
The system uses a dual-collection approach:
- \`{client}_catalog\` for document summaries
- \`{client}_chunks\` for searchable content pieces

## Performance Optimizations
- SHA256 hashing for deduplication
- Batch processing for embeddings
- Concurrency control with p-limit
- Incremental updates for efficiency

## Security & Privacy
- Local-first processing
- Client data isolation
- No external API dependencies
`
    },
    {
      name: 'getting-started.md',
      content: `# Getting Started Guide

## Quick Setup
1. Install dependencies: \`npm install\`
2. Configure environment: \`npm run setup\`
3. Build project: \`npm run build\`
4. Seed documents: \`npm run seed -- --client test --filesdir ./sample-docs\`

## Testing
Use the MCP tools in Claude Desktop:
- \`collection_info\` - Check system status
- \`catalog_search\` - Find documents by topic
- \`chunks_search\` - Search within document content

## Best Practices
- Use specific client names for organization
- Process documents incrementally for efficiency
- Monitor system resources during large imports
`
    }
  ];
  
  sampleDocs.forEach(doc => {
    const filePath = path.join(sampleDir, doc.name);
    fs.writeFileSync(filePath, doc.content);
  });
  
  console.log(chalk.green(`✅ Sample documents created in ${sampleDir}`));
  console.log(chalk.cyan('💡 Test with: npm run seed -- --client test --filesdir ./sample-docs'));
}

async function runTests() {
  console.log(chalk.blue('\n🧪 Running connection tests...\n'));
  
  try {
    // Test Qdrant connection
    const { default: axios } = await import('axios');
    
    console.log('Testing Qdrant connection...');
    await axios.get('http://localhost:6333/collections', { timeout: 5000 });
    console.log(chalk.green('✅ Qdrant connection successful'));
    
    console.log('Testing LM Studio connection...');
    await axios.get('http://127.0.0.1:1235/v1/models', { timeout: 5000 });
    console.log(chalk.green('✅ LM Studio connection successful'));
    
    console.log(chalk.green('\n🎉 All systems ready!'));
    
  } catch (error) {
    console.log(chalk.yellow('\n⚠️  Some services are not available:'));
    console.log(chalk.yellow('   Make sure Qdrant and LM Studio are running'));
    console.log(chalk.yellow('   See README.md for setup instructions'));
  }
}

async function main() {
  try {
    console.log(chalk.gray(`Installation directory: ${targetDir}\n`));
    
    await checkDependencies();
    await createConfig();
    await setupClaudeDesktop();
    await generateSampleDocs();
    await runTests();
    
    console.log(chalk.green.bold('\n🎉 Setup complete!'));
    console.log(chalk.cyan('\nNext steps:'));
    console.log(chalk.cyan('1. Start Qdrant and LM Studio if not already running'));
    console.log(chalk.cyan('2. Test with: npm run seed -- --client test --filesdir ./sample-docs'));
    console.log(chalk.cyan('3. Use in Claude Desktop with the configured MCP server'));
    console.log(chalk.cyan('4. See README.md for detailed usage instructions\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Setup failed:'), error.message);
    process.exit(1);
  }
}

main();
