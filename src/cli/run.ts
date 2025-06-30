import { createServer } from '../server/index.js';
import { loadMockEndpoints } from '../server/loader.js';
import { ServerOptions } from '../types/index.js';
import chalk from 'chalk';
import { existsSync } from 'fs';

export async function startServer(options: ServerOptions): Promise<void> {
  const { port, mockDir } = options;

  if (!existsSync(mockDir)) {
    console.error(chalk.red(`Mock directory "${mockDir}" does not exist.`));
    console.log(chalk.yellow(`Please create the directory and add YAML files with your mock endpoints.`));
    process.exit(1);
  }

  try {
    console.log(chalk.blue(`🔍 Loading mock endpoints from ${mockDir}...`));
    const endpoints = await loadMockEndpoints(mockDir);

    if (endpoints.length === 0) {
      console.log(chalk.yellow(`⚠️  No mock endpoints found in ${mockDir}`));
      console.log(chalk.gray('Create YAML files with your mock API definitions to get started.'));
    } else {
      console.log(chalk.green(`✅ Loaded ${endpoints.length} mock endpoint${endpoints.length > 1 ? 's' : ''}`));
    }

    const app = createServer(endpoints);

    app.listen(port, () => {
      console.log(chalk.green(`🚀 Mock server running on http://localhost:${port}`));

      if (endpoints.length > 0) {
        console.log(chalk.blue('\n📋 Available endpoints:'));
        endpoints.forEach(endpoint => {
          const methodColor = getMethodColor(endpoint.method);
          console.log(`  ${methodColor(endpoint.method.padEnd(6))} ${chalk.gray(endpoint.fullPath)}`);
        });
      }

      console.log(chalk.gray('\nPress Ctrl+C to stop the server'));
    });

  } catch (error) {
    console.error(chalk.red('Failed to start server:'), error);
    process.exit(1);
  }
}

function getMethodColor(method: string): (text: string) => string {
  switch (method) {
    case 'GET': return chalk.blue;
    case 'POST': return chalk.green;
    case 'PUT': return chalk.yellow;
    case 'DELETE': return chalk.red;
    case 'PATCH': return chalk.magenta;
    default: return chalk.white;
  }
}
