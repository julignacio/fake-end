# FakeIt

A modern TypeScript CLI tool for mocking backend APIs using YAML files. Perfect for frontend developers who need to simulate backend APIs during development.

## Features

- 🚀 **Fast Setup**: Get a mock API server running in seconds
- 📝 **YAML Configuration**: Define your mock endpoints in simple YAML files
- 🔄 **Path Parameters**: Support for dynamic route parameters (e.g., `/users/:id`)
- 🎯 **Response Templating**: Interpolate request data into responses
- ⏱️ **Latency Simulation**: Add realistic delays to your mock responses
- 🌈 **Beautiful Logging**: Colorful console output with request details
- 📁 **Folder Structure**: Organize your mocks with nested folder structures

## Installation

```bash
npm install -g fakeit
```

Or use it directly with npx:

```bash
npx fakeit run
```

## Quick Start

1. Create a `mock_server` directory in your project root
2. Add YAML files with your mock endpoint definitions
3. Run the server

```bash
mkdir mock_server
echo "- method: GET
  path: /hello
  status: 200
  body:
    message: 'Hello, World!'" > mock_server/hello.yaml

npx fakeit run
```

Your mock server will be running at `http://localhost:4000`!

## YAML File Format

Each YAML file contains an array of endpoint definitions:

```yaml
- method: GET           # HTTP method (GET, POST, PUT, DELETE, PATCH)
  path: /users/:id      # Route path (supports parameters)
  status: 200           # HTTP status code
  body:                 # Response body (can be any valid JSON)
    id: ":id"
    name: "Mock User"
    email: "user@example.com"
  delayMs: 150          # Optional delay in milliseconds
```

## Folder Structure and Routing

Files in nested folders become part of the URL path:

```
mock_server/
├── users.yaml              # Routes: /users/*
├── auth.yaml               # Routes: /auth/*
└── api/
    └── v1/
        └── products.yaml   # Routes: /api/v1/products/*
```

## Path Parameters and Templating

### Path Parameters

Use `:parameter` syntax in your paths:

```yaml
- method: GET
  path: /users/:id
  status: 200
  body:
    id: ":id"                    # Will be replaced with actual parameter
    name: "User :id"             # Dynamic interpolation
```

### Request Data Templating

Access request data in your responses:

```yaml
- method: POST
  path: /users
  status: 201
  body:
    name: "{{body.name}}"        # From request body
    email: "{{body.email}}"      # From request body
    id: "{{query.generateId}}"   # From query parameters
```

## CLI Options

```bash
fakeit run [options]

Options:
  -p, --port <port>        Port to run the server on (default: 4000)
  -d, --dir <directory>    Directory containing mock YAML files (default: mock_server)
  -h, --help              Display help for command
```

## Examples

### Basic User API

**mock_server/users.yaml:**
```yaml
- method: GET
  path: /users
  status: 200
  body:
    - id: "1"
      name: "John Doe"
      email: "john@example.com"
    - id: "2"
      name: "Jane Smith"
      email: "jane@example.com"

- method: GET
  path: /users/:id
  status: 200
  body:
    id: ":id"
    name: "User :id"
    email: "user:id@example.com"
  delayMs: 100

- method: POST
  path: /users
  status: 201
  body:
    id: "new-user-id"
    name: "{{body.name}}"
    email: "{{body.email}}"
    message: "User created successfully"
```

### Authentication API

**mock_server/auth.yaml:**
```yaml
- method: POST
  path: /auth/login
  status: 200
  body:
    token: "mock-jwt-token"
    user:
      id: "1"
      email: "{{body.email}}"
      name: "Mock User"
  delayMs: 200

- method: POST
  path: /auth/register
  status: 201
  body:
    message: "User registered successfully"
    user:
      id: "new-user-id"
      email: "{{body.email}}"
      name: "{{body.name}}"
```

### Nested API Structure

**mock_server/api/v1/products.yaml:**
```yaml
- method: GET
  path: /products
  status: 200
  body:
    data:
      - id: "1"
        name: "Product 1"
        price: 99.99
    pagination:
      page: 1
      total: 1

- method: GET
  path: /products/:id
  status: 200
  body:
    id: ":id"
    name: "Product :id"
    price: 49.99
```

This creates endpoints at:
- `GET /api/v1/products`
- `GET /api/v1/products/:id`

## Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Start in development mode
npm run dev run

# Build the project
npm run build

# Run the built version
npm start
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
