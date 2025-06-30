import express from "express";
import chalk from "chalk";
import { ParsedEndpoint, isValidMethod, validLowercaseMethods } from "../types/index.js";

export function createServer(endpoints: ParsedEndpoint[]) {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  for (const endpoint of endpoints) {
    if (!isValidMethod(endpoint.method.toUpperCase())) {
      console.log(
        chalk.red(endpoint.method),
        chalk.red(endpoint.fullPath),
        'is not a valid express endpoint',
      )
      continue;
    };
    const method: validLowercaseMethods = endpoint.method.toLowerCase() as validLowercaseMethods;

    app[method](endpoint.fullPath, async (req, res) => {
      const startTime = Date.now();

      console.log(
        chalk.gray(`[${new Date().toISOString()}]`),
        getMethodColor(endpoint.method)(endpoint.method),
        chalk.blue(req.path),
        chalk.gray(`(${endpoint.filePath})`),
      );

      if (endpoint.delayMs && endpoint.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, endpoint.delayMs));
      }

      let responseBody = endpoint.body;

      if (
        typeof responseBody === "string" ||
        typeof responseBody === "object"
      ) {
        responseBody = interpolateParams(
          responseBody,
          req.params,
          req.query,
          req.body,
        );
      }

      const duration = Date.now() - startTime;
      console.log(
        chalk.gray(`  → ${endpoint.status}`),
        chalk.gray(`(${duration}ms)`),
      );

      res.status(endpoint.status).json(responseBody);
    });
  }

  app.use("*", (req, res) => {
    console.log(
      chalk.gray(`[${new Date().toISOString()}]`),
      chalk.red("404"),
      chalk.blue(req.path),
      chalk.gray("(no mock found)"),
    );

    res.status(404).json({
      error: "Mock endpoint not found",
      path: req.path,
      method: req.method,
      message: "No mock endpoint matches this request. Check your YAML files.",
    });
  });

  return app;
}

function interpolateParams(obj: any, params: any, query: any, body: any): any {
  if (typeof obj === "string") {
    return obj
      .replace(/:(\w+)/g, (match, key) => params[key] || match)
      .replace(/\{\{query\.(\w+)\}\}/g, (match, key) => query[key] || match)
      .replace(/\{\{body\.(\w+)\}\}/g, (match, key) => body[key] || match);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateParams(item, params, query, body));
  }

  if (obj && typeof obj === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateParams(value, params, query, body);
    }
    return result;
  }

  return obj;
}

function getMethodColor(method: string): (text: string) => string {
  switch (method) {
    case "GET":
      return chalk.blue;
    case "POST":
      return chalk.green;
    case "PUT":
      return chalk.yellow;
    case "DELETE":
      return chalk.red;
    case "PATCH":
      return chalk.magenta;
    default:
      return chalk.white;
  }
}
