#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { startServer } from './run.js';

const program = new Command();

program
  .name('fakeit')
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

program.parse();