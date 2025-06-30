import { readFile } from 'fs/promises';
import { glob } from 'glob';
import * as yaml from 'js-yaml';
import path from 'path';
import { MockEndpoint, ParsedEndpoint } from '../types/index.js';
import chalk from 'chalk';

export async function loadMockEndpoints(mockDir: string): Promise<ParsedEndpoint[]> {
  const yamlFiles = await glob(`${mockDir}/**/*.yaml`, { absolute: true });
  const ymlFiles = await glob(`${mockDir}/**/*.yml`, { absolute: true });
  const allFiles = [...yamlFiles, ...ymlFiles];

  const endpoints: ParsedEndpoint[] = [];

  for (const filePath of allFiles) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const parsedContent = yaml.load(content) as MockEndpoint[];

      if (!Array.isArray(parsedContent)) {
        console.warn(chalk.yellow(`⚠️  File ${filePath} does not contain an array of endpoints`));
        continue;
      }

      const relativePath = path.relative(mockDir, filePath);
      const pathWithoutExt = relativePath.replace(/\.(yaml|yml)$/, '');
      const basePath = pathWithoutExt === 'index' ? '' : `/${pathWithoutExt}`;

      for (const endpoint of parsedContent) {
        if (!isValidEndpoint(endpoint)) {
          console.warn(chalk.yellow(`⚠️  Invalid endpoint in ${filePath}:`, endpoint));
          continue;
        }

        const fullPath = basePath + endpoint.path;

        endpoints.push({
          ...endpoint,
          filePath,
          fullPath: fullPath.replace(/\/+/g, '/') // Clean up double slashes
        });
      }
    } catch (error) {
      console.error(chalk.red(`❌ Error loading ${filePath}:`), error);
    }
  }

  return endpoints;
}

function isValidEndpoint(endpoint: any): endpoint is MockEndpoint {
  return (
    endpoint &&
    typeof endpoint === 'object' &&
    typeof endpoint.method === 'string' &&
    ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(endpoint.method.toUpperCase()) &&
    typeof endpoint.path === 'string' &&
    typeof endpoint.status === 'number' &&
    endpoint.body !== undefined
  );
}
