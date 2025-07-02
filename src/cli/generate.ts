import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { exec } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';

const execAsync = promisify(exec);

interface GenerateOptions {
  curl?: string;
  file?: string;
  output: string;
  execute?: boolean;
  ollama?: boolean;
  ollamaModel: string;
  ollamaHost: string;
}

interface CurlInfo {
  method: string;
  url: string;
  headers: Record<string, string>;
  data?: string;
  path: string;
  queryParams: Record<string, string>;
}

interface MockEndpoint {
  method: string;
  path: string;
  status: number;
  body: Record<string, unknown> | Array<unknown> | string | number | boolean;
  headers?: Record<string, string>;
  delayMs?: number;
}

export async function generateMockFromCurl(options: GenerateOptions): Promise<void> {
  try {
    // Get cURL command from options or file
    let curlCommand: string;
    if (options.curl) {
      curlCommand = options.curl;
    } else if (options.file) {
      curlCommand = await fs.readFile(options.file, 'utf8');
    } else {
      throw new Error('Either --curl or --file option must be provided');
    }

    console.log(chalk.blue('🔍 Analyzing cURL command...'));
    
    // Parse cURL command
    const curlInfo = parseCurlCommand(curlCommand);
    console.log(chalk.green(`✓ Parsed ${curlInfo.method} request to ${curlInfo.path}`));

    // Generate mock response
    let mockResponse: Record<string, unknown> | Array<unknown> | string | number | boolean;
    let actualResponse: string | null = null;
    
    // Determine if we should execute the cURL command
    let shouldExecute: boolean;
    
    if (options.execute === true) {
      // --execute flag was used
      shouldExecute = true;
    } else if (options.execute === false) {
      // --no-execute flag was used
      shouldExecute = false;
    } else {
      // No flag provided, prompt the user
      shouldExecute = await promptUserForExecution();
    }
    
    if (shouldExecute) {
      console.log(chalk.blue('🚀 Executing cURL command to capture actual response...'));
      actualResponse = await executeCurlCommand(curlCommand);
    }
    
    if (actualResponse) {
      console.log(chalk.green('✓ Using actual response from cURL execution'));
      try {
        mockResponse = JSON.parse(actualResponse);
      } catch {
        // If response is not JSON, use it as is
        mockResponse = actualResponse;
      }
    } else if (options.ollama) {
      console.log(chalk.blue(`🤖 Generating response using Ollama (${options.ollamaModel})...`));
      mockResponse = await generateResponseWithOllama(curlInfo, options.ollamaHost, options.ollamaModel);
    } else {
      console.log(chalk.blue('📝 Generating basic mock response...'));
      mockResponse = generateBasicMockResponse(curlInfo);
    }

    // Create mock endpoint
    const mockEndpoint: MockEndpoint = {
      method: curlInfo.method,
      path: curlInfo.path,
      status: getDefaultStatusCode(curlInfo.method),
      body: mockResponse,
      delayMs: Math.floor(Math.random() * 200) + 50 // Random delay between 50-250ms
    };

    // Ensure output directory exists
    await fs.mkdir(options.output, { recursive: true });

    // Generate file path based on URL structure
    const filePath = generateFilePath(curlInfo, options.output);
    
    // Write YAML file
    await writeYamlFile(filePath, [mockEndpoint]);
    
    console.log(chalk.green(`✅ Mock file generated: ${filePath}`));
    console.log(chalk.gray(`   Method: ${mockEndpoint.method}`));
    console.log(chalk.gray(`   Path: ${mockEndpoint.path}`));
    console.log(chalk.gray(`   Status: ${mockEndpoint.status}`));

  } catch (error) {
    throw new Error(`Failed to generate mock: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function parseCurlCommand(curlCommand: string): CurlInfo {
  // Clean up the curl command
  const cleanedCommand = curlCommand
    .replace(/\\\s*\n\s*/g, ' ') // Remove line continuations
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();

  // Extract method
  const methodMatch = cleanedCommand.match(/--request\s+(\w+)|--X\s+(\w+)|-X\s+(\w+)/i);
  const method = (methodMatch?.[1] || methodMatch?.[2] || methodMatch?.[3] || 'GET').toUpperCase();

  // Extract URL - try multiple patterns
  let fullUrl: string | undefined;
  
  // Pattern 1: --url flag
  const urlFlagMatch = cleanedCommand.match(/--url\s+([^\s]+)/);
  if (urlFlagMatch) {
    fullUrl = urlFlagMatch[1];
  } else {
    // Pattern 2: curl followed by URL (after method flags)
    const curlMatch = cleanedCommand.match(/curl\s+(?:-[A-Z]\s+\w+\s+)?([^\s-]+(?:\/[^\s]*)?)/i);
    if (curlMatch) {
      fullUrl = curlMatch[1];
    } else {
      // Pattern 3: Any URL-like string in command
      const urlPatternMatch = cleanedCommand.match(/(https?:\/\/[^\s]+)/);
      if (urlPatternMatch) {
        fullUrl = urlPatternMatch[1];
      }
    }
  }
  
  if (!fullUrl) {
    throw new Error('Could not extract URL from cURL command');
  }
  
  // Handle malformed URLs or add protocol if missing
  let processedUrl = fullUrl;
  if (!processedUrl.startsWith('http')) {
    processedUrl = 'https://' + processedUrl;
  }
  
  // Parse URL
  const url = new URL(processedUrl);
  const path = url.pathname;
  const queryParams: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  // Extract headers
  const headers: Record<string, string> = {};
  const headerMatches = cleanedCommand.matchAll(/--header\s+'([^']+)'|--header\s+"([^"]+)"|--header\s+([^\s]+)|-H\s+'([^']+)'|-H\s+"([^"]+)"|-H\s+([^\s]+)/g);
  
  for (const match of headerMatches) {
    const headerValue = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
    if (headerValue) {
      const [key, ...valueParts] = headerValue.split(':');
      if (key && valueParts.length > 0) {
        headers[key.trim().toLowerCase()] = valueParts.join(':').trim();
      }
    }
  }

  // Extract data
  const dataMatch = cleanedCommand.match(/--data\s+'([^']+)'|--data\s+"([^"]+)"|--data\s+([^\s]+)|-d\s+'([^']+)'|-d\s+"([^"]+)"|-d\s+([^\s]+)/);
  const data = dataMatch?.[1] || dataMatch?.[2] || dataMatch?.[3] || dataMatch?.[4] || dataMatch?.[5] || dataMatch?.[6];

  return {
    method,
    url: processedUrl,
    headers,
    data,
    path,
    queryParams
  };
}

async function promptUserForExecution(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log(chalk.cyan('\n🤔 How would you like to generate the mock response?'));
    console.log(chalk.white('  1. Execute the cURL command to capture the actual response (recommended)'));
    console.log(chalk.white('  2. Infer the response structure (faster, but less accurate)'));
    
    rl.question(chalk.yellow('\nChoose an option (1/2) [default: 1]: '), (answer) => {
      rl.close();
      
      const choice = answer.trim() || '1';
      const shouldExecute = choice === '1' || choice.toLowerCase() === 'execute' || choice.toLowerCase() === 'e';
      
      if (shouldExecute) {
        console.log(chalk.green('✓ Will execute cURL command to capture actual response'));
      } else {
        console.log(chalk.blue('✓ Will infer response structure'));
      }
      
      resolve(shouldExecute);
    });
  });
}

async function executeCurlCommand(curlCommand: string): Promise<string | null> {
  try {
    // Clean up the curl command for execution
    const cleanedCommand = curlCommand
      .replace(/\\\s*\n\s*/g, ' ') // Remove line continuations
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    console.log(chalk.gray(`   Running: ${cleanedCommand.substring(0, 100)}${cleanedCommand.length > 100 ? '...' : ''}`));
    
    const { stdout, stderr } = await execAsync(cleanedCommand, {
      timeout: 30000, // 30 second timeout
      maxBuffer: 1024 * 1024, // 1MB buffer
    });

    if (stderr && !stdout) {
      console.log(chalk.yellow(`⚠️  cURL stderr: ${stderr.substring(0, 200)}`));
      return null;
    }

    if (!stdout.trim()) {
      console.log(chalk.yellow('⚠️  cURL returned empty response'));
      return null;
    }

    return stdout.trim();
    
  } catch (error) {
    console.log(chalk.yellow(`⚠️  cURL execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    return null;
  }
}

function generateBasicMockResponse(curlInfo: CurlInfo): Record<string, unknown> {
  const { method, path, data } = curlInfo;

  // Try to parse request data to understand expected response structure
  let requestBody: Record<string, unknown> = {};
  if (data) {
    try {
      requestBody = JSON.parse(data);
    } catch {
      // If not JSON, create a simple object
      requestBody = { data: data };
    }
  }

  switch (method) {
    case 'GET':
      if (path.includes(':id') || /\/\d+$/.test(path)) {
        // Single resource
        return {
          id: path.includes(':id') ? ':id' : '1',
          name: `Resource ${path.includes(':id') ? ':id' : '1'}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } else {
        // Collection
        return {
          data: [
            {
              id: '1',
              name: 'Resource 1',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              id: '2', 
              name: 'Resource 2',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 2
          }
        };
      }

    case 'POST':
      return {
        id: 'new-resource-id',
        ...requestBody,
        message: 'Resource created successfully',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

    case 'PUT':
    case 'PATCH':
      return {
        id: path.includes(':id') ? ':id' : '1',
        ...requestBody,
        message: 'Resource updated successfully',
        updatedAt: new Date().toISOString()
      };

    case 'DELETE':
      return {
        message: 'Resource deleted successfully',
        deletedAt: new Date().toISOString()
      };

    default:
      return {
        message: 'Success',
        timestamp: new Date().toISOString()
      };
  }
}

async function generateResponseWithOllama(curlInfo: CurlInfo, host: string, model: string): Promise<Record<string, unknown>> {
  try {
    const prompt = createOllamaPrompt(curlInfo);
    
    const response = await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    // Try to extract JSON from the response
    const jsonMatch = result.response.match(/```json\s*([\s\S]*?)\s*```|({[\s\S]*})/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1] || jsonMatch[2]);
      } catch {
        // Fallback to basic response if JSON parsing fails
        console.log(chalk.yellow('⚠️  Could not parse Ollama JSON response, using fallback'));
        return generateBasicMockResponse(curlInfo);
      }
    }

    // Fallback to basic response
    return generateBasicMockResponse(curlInfo);
    
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Ollama request failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    console.log(chalk.yellow('   Falling back to basic mock response'));
    return generateBasicMockResponse(curlInfo);
  }
}

function createOllamaPrompt(curlInfo: CurlInfo): string {
  const { method, path, data, headers } = curlInfo;
  
  return `You are helping to create a realistic mock API response. 

Analyze this HTTP request and generate a realistic JSON response:

Method: ${method}
Path: ${path}
Headers: ${JSON.stringify(headers, null, 2)}
${data ? `Request Body: ${data}` : ''}

Please generate a realistic JSON response that:
1. Matches the expected response structure for this type of API endpoint
2. Uses realistic data types and values
3. Includes common fields like id, timestamps, etc. when appropriate
4. Reflects the request data when relevant (for POST/PUT requests)

Return only the JSON response without any explanation or markdown formatting.`;
}

function getDefaultStatusCode(method: string): number {
  switch (method) {
    case 'GET':
      return 200;
    case 'POST':
      return 201;
    case 'PUT':
    case 'PATCH':
      return 200;
    case 'DELETE':
      return 200;
    default:
      return 200;
  }
}

function generateFilePath(curlInfo: CurlInfo, outputDir: string): string {
  const { path: urlPath } = curlInfo;
  
  // Convert URL path to file path
  let filePath = urlPath.replace(/^\//, '').replace(/\/$/, '');
  
  // Replace path parameters with generic names
  filePath = filePath.replace(/\/:\w+/g, '');
  filePath = filePath.replace(/\/\{\w+\}/g, '');
  
  // If empty, use 'index'
  if (!filePath) {
    filePath = 'index';
  }
  
  // Replace slashes with directories
  const pathParts = filePath.split('/');
  const fileName = pathParts.pop() || 'index';
  const dirPath = pathParts.length > 0 ? pathParts.join('/') : '';
  
  const fullDirPath = dirPath ? path.join(outputDir, dirPath) : outputDir;
  return path.join(fullDirPath, `${fileName}.yaml`);
}

async function writeYamlFile(filePath: string, endpoints: MockEndpoint[]): Promise<void> {
  // Ensure directory exists
  const dirPath = path.dirname(filePath);
  await fs.mkdir(dirPath, { recursive: true });
  
  // Read existing file if it exists
  let existingEndpoints: MockEndpoint[] = [];
  try {
    const existingContent = await fs.readFile(filePath, 'utf8');
    const parsed = yaml.load(existingContent);
    if (Array.isArray(parsed)) {
      existingEndpoints = parsed;
    }
  } catch {
    // File doesn't exist or is invalid, start fresh
  }
  
  // Merge with existing endpoints (avoid duplicates based on method + path)
  const mergedEndpoints = [...existingEndpoints];
  for (const newEndpoint of endpoints) {
    const existingIndex = mergedEndpoints.findIndex(
      ep => ep.method === newEndpoint.method && ep.path === newEndpoint.path
    );
    
    if (existingIndex >= 0) {
      // Replace existing endpoint
      mergedEndpoints[existingIndex] = newEndpoint;
    } else {
      // Add new endpoint
      mergedEndpoints.push(newEndpoint);
    }
  }
  
  // Write YAML file
  const yamlContent = yaml.dump(mergedEndpoints, {
    indent: 2,
    lineWidth: -1,
    noRefs: true
  });
  
  await fs.writeFile(filePath, yamlContent, 'utf8');
}