#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { startServer } from './run.js';
import { generateDocumentation } from './document.js';

const program = new Command();

program
  .name('fake-end')
  .description('A modern CLI tool for mocking backend APIs using YAML files')
  .version('1.0.0');

program
  .command('run')
  .description('Start the mock server')
  .option('-p, --port <port>', 'Port to run the server on', '4000')
  .option('-d, --dir <directory>', 'Directory containing mock YAML files', 'mock_server')
  .action(async (options) => {
    try {
      await startServer({
        port: parseInt(options.port, 10),
        mockDir: options.dir
      });
    } catch (error) {
      console.error(chalk.red('Error starting server:'), error);
      process.exit(1);
    }
  });

program
  .command('document')
  .description('Generate markdown documentation for mock endpoints')
  .option('-d, --dir <directory>', 'Directory containing mock YAML files', 'mock_server')
  .option('-o, --output <file>', 'Output file for documentation', 'api-documentation.md')
  .option('--ollama', 'Use Ollama for AI-enhanced documentation')
  .option('--ollama-model <model>', 'Ollama model to use', 'codellama:7b')
  .option('--ollama-host <host>', 'Ollama host URL', 'http://localhost:11434')
  .action(async (options) => {
    try {
      await generateDocumentation({
        mockDir: options.dir,
        output: options.output,
        ollama: options.ollama,
        ollamaModel: options.ollamaModel,
        ollamaHost: options.ollamaHost
      });
    } catch (error) {
      console.error(chalk.red('Error generating documentation:'), error);
      process.exit(1);
    }
  });

program.parse();