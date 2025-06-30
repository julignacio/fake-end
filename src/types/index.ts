export type validMethods = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type validLowercaseMethods = 'get' | 'post' | 'put' | 'delete' | 'patch';

export const isValidMethod = (tentativeMethod: string): tentativeMethod is validMethods => (
  ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(tentativeMethod)
);

export interface MockEndpoint {
  method: validMethods;
  path: string;
  status: number;
  body: unknown;
  delayMs?: number;
};

export interface ParsedEndpoint extends MockEndpoint {
  filePath: string;
  fullPath: string;
};

export interface ServerOptions {
  port: number;
  mockDir: string;
};

