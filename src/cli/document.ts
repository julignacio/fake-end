import { writeFile } from 'fs/promises';
import { loadMockEndpoints } from '../server/loader.js';
import { ParsedEndpoint } from '../types/index.js';
import { OllamaService } from './ollama.js';
import chalk from 'chalk';
import path from 'path';

export interface DocumentOptions {
  mockDir: string;
  output?: string;
  ollama?: boolean;
  ollamaModel?: string;
  ollamaHost?: string;
}

export async function generateDocumentation(options: DocumentOptions): Promise<void> {
  const { mockDir, output = 'api-documentation.md', ollama = false, ollamaModel, ollamaHost } = options;

  try {
    console.log(chalk.blue(`🔍 Loading mock endpoints from ${mockDir}...`));
    const endpoints = await loadMockEndpoints(mockDir);

    if (endpoints.length === 0) {
      console.log(chalk.yellow(`⚠️  No mock endpoints found in ${mockDir}`));
      console.log(chalk.gray('Create YAML files with your mock API definitions to get started.'));
      return;
    }

    console.log(chalk.green(`✅ Found ${endpoints.length} endpoint${endpoints.length > 1 ? 's' : ''}`));
    
    let ollamaService: OllamaService | undefined;
    if (ollama) {
      console.log(chalk.blue('🤖 Initializing Ollama integration...'));
      ollamaService = new OllamaService({ 
        model: ollamaModel, 
        host: ollamaHost 
      });
      
      const isAvailable = await ollamaService.isAvailable();
      if (!isAvailable) {
        console.log(chalk.yellow('⚠️  Ollama not available or model not found. Continuing without AI descriptions.'));
        ollamaService = undefined;
      } else {
        console.log(chalk.green(`✅ Ollama connected with model: ${ollamaService['model']}`));
      }
    }
    
    const documentation = await generateMarkdownDocumentation(endpoints, mockDir, ollamaService);
    
    await writeFile(output, documentation, 'utf-8');
    
    console.log(chalk.green(`📄 Documentation generated: ${path.resolve(output)}`));
  } catch (error) {
    console.error(chalk.red('Failed to generate documentation:'), error);
    process.exit(1);
  }
}

async function generateMarkdownDocumentation(endpoints: ParsedEndpoint[], mockDir: string, ollamaService?: OllamaService): Promise<string> {
  const groupedEndpoints = groupEndpointsByFile(endpoints);
  
  let markdown = `# API Documentation

This documentation was automatically generated from mock endpoint definitions in \`${mockDir}\`.

Generated on: ${new Date().toISOString()}`;

  // Add endpoint summary (always included)
  markdown += `

## API Endpoints Summary

`;

  endpoints.forEach(endpoint => {
    const statusEmoji = getStatusEmoji(endpoint.status);
    markdown += `- **${endpoint.method} ${endpoint.fullPath}** ${statusEmoji}\n`;
  });

  if (ollamaService) {
    console.log(chalk.blue('🤖 Generating AI overview...'));
    const apiOverview = await ollamaService.generateApiOverview(endpoints);
    if (apiOverview) {
      markdown += `

## AI-Generated Overview

${apiOverview}`;
    }
  }

  markdown += `

---

`;

  // Table of Contents
  markdown += `## Table of Contents

`;
  
  Object.keys(groupedEndpoints).forEach(filePath => {
    const relativePath = path.relative(mockDir, filePath);
    const sectionName = relativePath.replace(/\.(yaml|yml)$/, '').replace(/\//g, ' / ');
    const anchorName = sectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    markdown += `- [${sectionName || 'Root'}](#${anchorName})\n`;
  });

  markdown += '\n---\n\n';

  // Generate documentation for each file group
  for (const [filePath, fileEndpoints] of Object.entries(groupedEndpoints)) {
    const relativePath = path.relative(mockDir, filePath);
    const sectionName = relativePath.replace(/\.(yaml|yml)$/, '').replace(/\//g, ' / ');
    
    markdown += `## ${sectionName || 'Root'}\n\n`;
    markdown += `**Source:** \`${relativePath}\`\n\n`;

    for (const endpoint of fileEndpoints) {
      markdown += await generateEndpointDocumentation(endpoint, ollamaService);
    }

    markdown += '\n---\n\n';
  }

  return markdown;
}

function groupEndpointsByFile(endpoints: ParsedEndpoint[]): Record<string, ParsedEndpoint[]> {
  return endpoints.reduce((groups, endpoint) => {
    const filePath = endpoint.filePath;
    if (!groups[filePath]) {
      groups[filePath] = [];
    }
    groups[filePath].push(endpoint);
    return groups;
  }, {} as Record<string, ParsedEndpoint[]>);
}

async function generateEndpointDocumentation(endpoint: ParsedEndpoint, ollamaService?: OllamaService): Promise<string> {
  let doc = `### ${endpoint.method} ${endpoint.fullPath}\n\n`;
  
  // AI-generated description
  if (ollamaService) {
    const description = await ollamaService.generateEndpointDescription(endpoint);
    if (description) {
      doc += `${description}\n\n`;
    }
  }
  
  // Basic info
  doc += `- **Method:** \`${endpoint.method}\`\n`;
  doc += `- **Path:** \`${endpoint.fullPath}\`\n`;
  doc += `- **Status Code:** \`${endpoint.status}\`\n`;
  
  if (endpoint.delayMs) {
    doc += `- **Simulated Delay:** ${endpoint.delayMs}ms\n`;
  }
  
  doc += '\n';

  // Request parameters (from path)
  const pathParams = extractPathParameters(endpoint.fullPath);
  if (pathParams.length > 0) {
    doc += '**Path Parameters:**\n\n';
    pathParams.forEach(param => {
      doc += `- \`${param}\` - Path parameter\n`;
    });
    doc += '\n';
  }

  // Response body
  if (endpoint.body !== null && endpoint.body !== undefined) {
    doc += '**Response Body:**\n\n';
    doc += '```json\n';
    doc += JSON.stringify(endpoint.body, null, 2);
    doc += '\n```\n\n';
  } else {
    doc += '**Response:** Empty body\n\n';
  }

  // Request body template (for POST/PUT/PATCH)
  if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
    const requestBodyTemplate = generateRequestBodyTemplate(endpoint.body);
    if (requestBodyTemplate) {
      doc += '**Request Body Template:**\n\n';
      doc += '```json\n';
      doc += JSON.stringify(requestBodyTemplate, null, 2);
      doc += '\n```\n\n';
    }
  }

  return doc;
}

function extractPathParameters(path: string): string[] {
  const matches = path.match(/:(\w+)/g);
  return matches ? matches.map(match => match.substring(1)) : [];
}

function generateRequestBodyTemplate(responseBody: unknown): Record<string, unknown> | null {
  if (!responseBody || typeof responseBody !== 'object') {
    return null;
  }

  const template: Record<string, unknown> = {};
  
  function processObject(obj: Record<string, unknown>, target: Record<string, unknown>) {
    if (Array.isArray(obj)) {
      return obj;
    }
    
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        
        if (typeof value === 'string' && value.includes('{{body.')) {
          // Extract the field name from {{body.fieldName}}
          const match = value.match(/\{\{body\.(\w+)\}\}/);
          if (match) {
            target[match[1]] = getExampleValue(key);
          }
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const nestedTarget: Record<string, unknown> = {};
          target[key] = nestedTarget;
          processObject(value as Record<string, unknown>, nestedTarget);
        }
      });
    }
  }

  processObject(responseBody as Record<string, unknown>, template);
  
  return Object.keys(template).length > 0 ? template : null;
}

function getStatusEmoji(status: number): string {
  if (status >= 200 && status < 300) return '✅';
  if (status >= 300 && status < 400) return '🔄';
  if (status >= 400 && status < 500) return '❌';
  if (status >= 500) return '🔥';
  return '❓';
}

function getEndpointDescription(endpoint: ParsedEndpoint): string {
  const path = endpoint.fullPath.toLowerCase();
  const method = endpoint.method;
  
  // Auth-specific endpoints
  if (path.includes('/auth/login')) return 'Authenticate user and return access token';
  if (path.includes('/auth/register')) return 'Register a new user account';
  if (path.includes('/auth/logout')) return 'End user session and invalidate token';
  if (path.includes('/auth/me')) return 'Get current authenticated user information';
  
  // Resource-specific descriptions
  if (method === 'GET') {
    if (path.includes('/:')) {
      return 'Retrieve a specific resource by ID';
    } else {
      return 'Retrieve a list of resources';
    }
  } else if (method === 'POST') {
    return 'Create a new resource';
  } else if (method === 'PUT') {
    return 'Update an existing resource';
  } else if (method === 'DELETE') {
    return 'Delete a resource';
  } else if (method === 'PATCH') {
    return 'Partially update a resource';
  }
  
  return 'Process request';
}

function getExampleValue(fieldName: string): string | number {
  const lowerField = fieldName.toLowerCase();
  
  if (lowerField.includes('email')) return 'user@example.com';
  if (lowerField.includes('name')) return 'John Doe';
  if (lowerField.includes('price')) return 29.99;
  if (lowerField.includes('category')) return 'Category Name';
  if (lowerField.includes('description')) return 'Description text';
  if (lowerField.includes('id')) return 'unique-id';
  if (lowerField.includes('phone')) return '+1234567890';
  if (lowerField.includes('address')) return '123 Main St';
  if (lowerField.includes('city')) return 'New York';
  if (lowerField.includes('country')) return 'USA';
  if (lowerField.includes('date')) return '2024-01-01';
  if (lowerField.includes('url')) return 'https://example.com';
  
  return 'string value';
}