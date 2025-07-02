#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { startServer } from './run.js';
import { generateMockFromCurl } from './generate.js';

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
  .command('generate')
  .description('Generate YAML mock files from cURL commands')
  .option('-c, --curl <curl>', 'cURL command to analyze and mock')
  .option('-f, --file <file>', 'File containing cURL command')
  .option('-o, --output <output>', 'Output directory for generated YAML files', 'mock_server')
  .option('--execute', 'Force execution of the cURL command to capture actual response')
  .option('--no-execute', 'Skip execution and infer response structure instead')
  .option('--ollama', 'Use Ollama for AI-powered response generation (only used if --execute fails)')
  .option('--ollama-model <model>', 'Ollama model to use', 'qwen2.5-coder:0.5b')
  .option('--ollama-host <host>', 'Ollama host URL', 'http://localhost:11434')
  .action(async (options) => {
    try {
      await generateMockFromCurl(options);
    } catch (error) {
      console.error(chalk.red('Error generating mock:'), error);
      process.exit(1);
    }
  });

program.parse();