#!/usr/bin/env node

import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log(chalk.cyan.bold('\n🚀 Claude Qdrant MCP - Post Install\n'));

// Check if this is a global install or local project setup
const isGlobalInstall = process.env.npm_config_global === 'true' || 
                       process.cwd().includes('node_modules');

if (isGlobalInstall) {
  console.log(chalk.green('✅ Package installed globally'));
  console.log(chalk.cyan('\nTo set up a new project:'));
  console.log(chalk.white('  mkdir my-rag-project'));
  console.log(chalk.white('  cd my-rag-project'));
  console.log(chalk.white('  qdrant-setup'));
  console.log('');
} else {
  console.log(chalk.green('✅ Package installed locally'));
  console.log(chalk.cyan('\nTo complete setup:'));
  console.log(chalk.white('  npm run setup'));
  console.log('');
}

console.log(chalk.gray('For manual configuration, see README.md'));
console.log(chalk.gray('For issues, visit: https://github.com/marlian/claude-qdrant-mcp/issues\n'));
