# FoFa MCP Server

A Model Context Protocol (MCP) server that provides access to FoFa API functionality, allowing AI assistants to query information about internet-connected devices and services.

## Features
- **Search Capabilities**: Search FoFa's database for devices and services based on various queries.
- **User Information**: Retrieve user information from FoFa, including account details and usage statistics.

## Installation
1. Clone the repository:
   ```bash
   git clone [Your GitHub Repo]
   cd fofa-mcp-server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the server:
   ```bash
   npm run build
   ```
4. Set up your FoFa API key and email:
   ```bash
   export FOFA_API_KEY="your-api-key-here"
   export FOFA_EMAIL="your-email-here"
   ```
5. Start the server:
   ```bash
   npm start
   ```

## MCP Integration
This server can be integrated with Claude or other MCP-compatible AI assistants. To add it to Claude Desktop or Claude.app:

1. Add the server to your MCP settings:
   ```json
   {
     "mcpServers": {
       "fofa": {
         "command": "node",
         "args": ["/path/to/fofa-mcp-server/build/index.js"],
         "env": {
           "FOFA_API_KEY": "your-api-key-here",
           "FOFA_EMAIL": "your-email-here"
         }
       }
     }
   }
   ```
2. Restart Claude to load the new MCP server.

## Tools
### `search_fofa`
- **Description**: Search FoFa's database for devices and services.
- **Input Schema**:
  - `query`: FoFa search query (e.g., 'app="Apache HTTP Server"').
  - `page`: Page number for results pagination (default: 1).
  - `size`: Number of results per page (default: 100).
  - `fields`: List of fields to include in the results (e.g., ['ip', 'port', 'title']).

### `get_user_info`
- **Description**: Get user information from FoFa.
- **Input Schema**:
  - 无参数。

## Requirements
- Node.js (version 16 or higher)
- npm (usually comes with Node.js)
- FoFa API key and email
