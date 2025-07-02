import { ParsedEndpoint } from '../types/index.js';
import chalk from 'chalk';

export interface OllamaOptions {
  model?: string;
  host?: string;
  timeout?: number;
}

export class OllamaService {
  private model: string;
  private host: string;
  private timeout: number;

  constructor(options: OllamaOptions = {}) {
    this.model = options.model || 'codellama:7b';
    this.host = options.host || 'http://localhost:11434';
    this.timeout = options.timeout || 30000;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.host}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json() as { models: { name: string }[] };
      return data.models.some(model => model.name === this.model);
    } catch {
      return false;
    }
  }

  async generateEndpointDescription(endpoint: ParsedEndpoint): Promise<string> {
    const prompt = `Generate a brief, professional description for this mock API endpoint. Focus on what the endpoint does and its purpose. Keep it concise (1-2 sentences):

Method: ${endpoint.method}
Path: ${endpoint.fullPath}
Status: ${endpoint.status}
Response: ${JSON.stringify(endpoint.body, null, 2)}

Description:`;

    try {
      const response = await fetch(`${this.host}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9,
            max_tokens: 100
          }
        }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json() as { response: string };
      return data.response.trim().replace(/^Description:\s*/, '');
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to generate description for ${endpoint.method} ${endpoint.fullPath}:`, error));
      return '';
    }
  }

  async generateApiOverview(endpoints: ParsedEndpoint[]): Promise<string> {
    const endpointSummary = endpoints.map(ep => 
      `${ep.method} ${ep.fullPath} - ${ep.status}`
    ).join('\n');

    const prompt = `Generate a brief overview description for this mocks API based on its endpoints. Focus on what the API does and its main purpose. Keep it concise (2-3 sentences):

Endpoints:
${endpointSummary}

API Overview:`;

    try {
      const response = await fetch(`${this.host}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9,
            max_tokens: 150
          }
        }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json() as { response: string };
      return data.response.trim().replace(/^API Overview:\s*/, '');
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Failed to generate API overview:'), error);
      return '';
    }
  }
}