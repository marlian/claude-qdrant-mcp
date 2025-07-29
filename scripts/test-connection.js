#!/usr/bin/env node

import chalk from 'chalk';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log(chalk.cyan.bold('\n🔍 Testing Connections\n'));

async function testQdrant() {
  const url = process.env.QDRANT_URL || 'http://localhost:6333';
  const apiKey = process.env.QDRANT_API_KEY;
  
  console.log(`Testing Qdrant at ${url}...`);
  
  try {
    const headers = {};
    if (apiKey) {
      headers['api-key'] = apiKey;
    }
    
    const response = await axios.get(`${url}/collections`, { 
      headers,
      timeout: 5000 
    });
    
    console.log(chalk.green('✅ Qdrant connection successful'));
    console.log(chalk.gray(`   Collections: ${response.data.result?.collections?.length || 0}`));
    
    return true;
  } catch (error) {
    console.log(chalk.red('❌ Qdrant connection failed'));
    if (error.code === 'ECONNREFUSED') {
      console.log(chalk.yellow('   💡 Start Qdrant with: docker run -p 6333:6333 qdrant/qdrant'));
    } else if (error.response?.status === 401) {
      console.log(chalk.yellow('   💡 Check your QDRANT_API_KEY in .env'));
    } else {
      console.log(chalk.gray(`   Error: ${error.message}`));
    }
    return false;
  }
}

async function testLMStudio() {
  const url = process.env.LM_STUDIO_URL || 'http://127.0.0.1:1235';
  
  console.log(`Testing LM Studio at ${url}...`);
  
  try {
    const response = await axios.get(`${url}/v1/models`, { timeout: 5000 });
    const models = response.data.data || [];
    
    console.log(chalk.green('✅ LM Studio connection successful'));
    console.log(chalk.gray(`   Available models: ${models.length}`));
    
    // Check for required models
    const embeddingModel = process.env.EMBEDDING_MODEL || 'text-embedding-finetuned-bge-m3';
    const llmModel = process.env.LLM_MODEL || 'qwen/qwen3-8b';
    
    const hasEmbedding = models.some(m => m.id.includes('bge') || m.id.includes('embedding'));
    const hasLLM = models.some(m => m.id.includes('qwen') || m.id.includes('chat'));
    
    if (hasEmbedding) {
      console.log(chalk.green('   ✅ Embedding model available'));
    } else {
      console.log(chalk.yellow('   ⚠️  No embedding model found (need BGE-M3)'));
    }
    
    if (hasLLM) {
      console.log(chalk.green('   ✅ Chat model available'));
    } else {
      console.log(chalk.yellow('   ⚠️  No chat model found (need Qwen3 or similar)'));
    }
    
    return true;
  } catch (error) {
    console.log(chalk.red('❌ LM Studio connection failed'));
    if (error.code === 'ECONNREFUSED') {
      console.log(chalk.yellow('   💡 Start LM Studio and enable server mode'));
    } else {
      console.log(chalk.gray(`   Error: ${error.message}`));
    }
    return false;
  }
}

async function testEnvironment() {
  console.log('Checking environment configuration...');
  
  const requiredVars = [
    'QDRANT_URL',
    'LM_STUDIO_URL', 
    'CLIENT_COLLECTIONS'
  ];
  
  let allSet = true;
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(chalk.green(`   ✅ ${varName}: ${value}`));
    } else {
      console.log(chalk.yellow(`   ⚠️  ${varName}: not set`));
      allSet = false;
    }
  });
  
  if (!allSet) {
    console.log(chalk.yellow('\n   💡 Run npm run setup to configure environment'));
  }
  
  return allSet;
}

async function main() {
  const results = await Promise.all([
    testEnvironment(),
    testQdrant(),
    testLMStudio()
  ]);
  
  const allPassed = results.every(r => r);
  
  console.log('');
  if (allPassed) {
    console.log(chalk.green.bold('🎉 All systems ready!'));
    console.log(chalk.cyan('\nYou can now:'));
    console.log(chalk.white('• Seed documents: npm run seed -- --client test --filesdir ./docs'));
    console.log(chalk.white('• Start MCP server: npm start'));
    console.log(chalk.white('• Use in Claude Desktop with configured MCP tools'));
  } else {
    console.log(chalk.yellow.bold('⚠️  Some systems need attention'));
    console.log(chalk.cyan('\nNext steps:'));
    console.log(chalk.white('• Check the error messages above'));
    console.log(chalk.white('• See README.md for detailed setup instructions'));
    console.log(chalk.white('• Run npm run setup for interactive configuration'));
  }
  console.log('');
}

main().catch(error => {
  console.error(chalk.red('Test failed:'), error.message);
  process.exit(1);
});
