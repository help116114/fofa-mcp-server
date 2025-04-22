#!/usr/bin/env node

/**
 * FoFa MCP Server
 *
 * Developed by [Your Name or Company].
 * Contact: [Your Email]
 * GitHub: [Your GitHub Repo]
 *
 * This server provides access to FoFa API functionality through the Model Context Protocol.
 * It allows AI assistants to query information about internet-connected devices and services,
 * enhancing cybersecurity research and threat intelligence capabilities.
 *
 * Copyright (c) [Year] [Your Name or Company]. All rights reserved.
 * Licensed under the MIT License.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListResourcesRequestSchema, ListToolsRequestSchema, McpError, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from "axios";
import { z } from "zod";

// Get the FoFa API key and email from environment variables
const FOFA_API_KEY = process.env.FOFA_API_KEY || "";
const FOFA_EMAIL = process.env.FOFA_EMAIL || "";
if (!FOFA_API_KEY || !FOFA_EMAIL) {
  throw new Error("FOFA_API_KEY and FOFA_EMAIL environment variables are required");
}

/**
 * FoFa API client class
 */
class FoFaClient {
  private axiosInstance: AxiosInstance;

  constructor(apiKey: string, email: string) {
    this.axiosInstance = axios.create({
      baseURL: "https://fofa.info/api/v1",
      params: {
        email,
        key: apiKey
      }
    });
  }

  /**
   * Sample and limit response data to reduce token usage
   * @param data The data to sample
   * @param maxItems Maximum number of items to include in arrays
   * @param selectedFields Optional array of field paths to include
   * @returns Sampled data
   */
  private sampleResponse(data: any, maxItems: number = 5, selectedFields?: string[]): any {
    if (!data) return data;

    // Clone the data to avoid modifying the original
    const result = JSON.parse(JSON.stringify(data));

    // Sample results array if it exists and is longer than maxItems
    if (result.results && Array.isArray(result.results) && result.results.length > maxItems) {
      result.results = result.results.slice(0, maxItems);
      result._sample_note = `Response truncated to ${maxItems} results. Original count: ${data.results.length}`;
    }

    // Filter fields if selectedFields is provided
    if (selectedFields && selectedFields.length > 0 && typeof result === 'object') {
      this.filterFields(result, selectedFields);
    }

    return result;
  }

  /**
   * Filter object to only include specified fields
   * @param obj Object to filter
   * @param fieldPaths Array of field paths (e.g. ['ip', 'port', 'title'])
   */
  private filterFields(obj: any, fieldPaths: string[]): void {
    if (!obj || typeof obj !== 'object') return;

    // For arrays, apply filtering to each item
    if (Array.isArray(obj)) {
      obj.forEach(item => this.filterFields(item, fieldPaths));
      return;
    }

    // Create a map of top-level fields and nested paths
    const fieldMap = new Map<string, string[]>();

    fieldPaths.forEach(path => {
      const parts = path.split('.');
      const topField = parts[0];

      if (parts.length > 1) {
        // This is a nested path
        const nestedPath = parts.slice(1).join('.');
        if (!fieldMap.has(topField)) {
          fieldMap.set(topField, []);
        }
        fieldMap.get(topField)?.push(nestedPath);
      } else {
        // This is a top-level field
        fieldMap.set(topField, []);
      }
    });

    // Get all current keys in the object
    const currentKeys = Object.keys(obj);

    // Remove keys that aren't in our fieldMap
    currentKeys.forEach(key => {
      if (!fieldMap.has(key) && key !== '_sample_note') {
        delete obj[key];
      } else if (fieldMap.has(key) && fieldMap.get(key)?.length && obj[key] && typeof obj[key] === 'object') {
        // This key has nested paths to filter
        this.filterFields(obj[key], fieldMap.get(key) || []);
      }
    });
  }

  /**
   * Search FoFa's database
   */
  async search(query: string, page: number = 1, size: number = 100, selectedFields?: string[]): Promise<any> {
    try {
      const params: any = {
        qbase64: Buffer.from(query).toString('base64'),
        page,
        size
      };

      const response = await this.axiosInstance.get("/search/all", { params });
      return this.sampleResponse(response.data, 5, selectedFields);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new McpError(
          ErrorCode.InternalError,
          `FoFa API error: ${error.response?.data?.error || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(): Promise<any> {
    try {
      const response = await this.axiosInstance.get("/info/my");
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        throw new McpError(
          ErrorCode.InternalError,
          `FoFa API error: ${error.response?.data?.error || error.message}`
        );
      }
      throw error;
    }
  }
}

/**
 * Create and configure the FoFa MCP server
 */
async function main() {
  // Create FoFa client
  const fofaClient = new FoFaClient(FOFA_API_KEY, FOFA_EMAIL);

  // Create MCP server
  const server = new Server(
    {
      name: "fofa-mcp-server",
      version: "0.1.0"
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  // Set up resource handlers
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "fofa://search/example",
          name: "FoFa Search Results",
          description: "Search results from FoFa based on a query",
          mimeType: "application/json"
        }
      ]
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request: any) => {
    const uri = request.params.uri;

    // Search results resource
    const searchMatch = uri.match(/^fofa:\/\/search\/([^/]+)$/);
    if (searchMatch) {
      const query = decodeURIComponent(searchMatch[1]);
      try {
        const searchResults = await fofaClient.search(query);
        return {
          contents: [{
            uri: uri,
            text: JSON.stringify(searchResults, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error getting search results: ${(error as Error).message}`
        );
      }
    }

    throw new McpError(
      ErrorCode.InvalidRequest,
      `Invalid URI format: ${uri}`
    );
  });

  // Set up tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "search_fofa",
          description: "Search FoFa's database for devices and services",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "FoFa search query (e.g., 'app=\"Apache HTTP Server\"')"
              },
              page: {
                type: "number",
                description: "Page number for results pagination (default: 1)"
              },
              size: {
                type: "number",
                description: "Number of results per page (default: 100)"
              },
              fields: {
                type: "array",
                items: {
                  type: "string"
                },
                description: "List of fields to include in the results (e.g., ['ip', 'port', 'title'])"
              }
            },
            required: ["query"]
          }
        },
        {
          name: "get_user_info",
          description: "Get user information from FoFa",
          inputSchema: {
            type: "object",
            properties: {}
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    switch (request.params.name) {
      case "search_fofa": {
        const query = String(request.params.arguments?.query);
        if (!query) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Search query is required"
          );
        }

        const page = Number(request.params.arguments?.page) || 1;
        const size = Number(request.params.arguments?.size) || 100;
        const fields = Array.isArray(request.params.arguments?.fields)
          ? request.params.arguments?.fields.map(String)
          : undefined;

        try {
          const searchResults = await fofaClient.search(query, page, size, fields);
          return {
            content: [{
              type: "text",
              text: JSON.stringify(searchResults, null, 2)
            }]
          };
        } catch (error) {
          if (error instanceof McpError) {
            throw error;
          }
          throw new McpError(
            ErrorCode.InternalError,
            `Error searching FoFa: ${(error as Error).message}`
          );
        }
      }

      case "get_user_info": {
        try {
          const userInfo = await fofaClient.getUserInfo();
          return {
            content: [{
              type: "text",
              text: JSON.stringify(userInfo, null, 2)
            }]
          };
        } catch (error) {
          if (error instanceof McpError) {
            throw error;
          }
          throw new McpError(
            ErrorCode.InternalError,
            `Error getting user info: ${(error as Error).message}`
          );
        }
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
    }
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("FoFa MCP server running on stdio");
}

main().catch((error) => {
  console.error("Error starting FoFa MCP server:", error);
});