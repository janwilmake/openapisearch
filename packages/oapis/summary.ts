import { dereferenceSync } from "@trojs/openapi-dereference";
import {
  OpenapiParameterObject,
  OpenapiResponseObject,
} from "./getOperations.js";
import { SchemaObject, OpenapiDocument } from "./types.js";

// Helper function to format schema with improved type handling
function formatSchema(schema: SchemaObject, indent: number = 0): string {
  const indentStr = "  ".repeat(indent);
  let output = "";

  if (!schema) return "any";

  if (schema.type === "object" && schema.properties) {
    output += "{\n";
    for (const [propName, prop] of Object.entries(schema.properties)) {
      const required = schema.required?.includes(propName) ? " (Required)" : "";
      output += `${indentStr}  ${propName}${required}: `;

      if (prop.description) {
        output += `// ${prop.description}\n${indentStr}  `;
      }

      if (prop.type === "object" && prop.properties) {
        output += formatSchema(prop, indent + 1);
      } else if (prop.type === "array" && prop.items) {
        output += `${prop.type}<`;
        if (prop.items.type === "object" && prop.items.properties) {
          output += formatSchema(prop.items, indent + 1);
        } else {
          output += prop.items.type;
          if (prop.items.enum) {
            output += ` (one of: ${prop.items.enum.join(", ")})`;
          }
        }
        output += ">";
      } else {
        output += prop.type;
        if (prop.enum) {
          output += ` (one of: ${prop.enum.join(", ")})`;
        }
        if (prop.format) {
          output += ` (${prop.format})`;
        }
        if (prop.pattern) {
          output += ` (pattern: ${prop.pattern})`;
        }
        if (prop.minimum !== undefined || prop.maximum !== undefined) {
          output += ` (range: ${prop.minimum ?? "-∞"} to ${
            prop.maximum ?? "∞"
          })`;
        }
        if (prop.default !== undefined) {
          output += ` = ${JSON.stringify(prop.default)}`;
        }
      }
      output += ",\n";
    }
    output += `${indentStr}}`;
  } else if (schema.type === "array" && schema.items) {
    output += `array<`;
    if (schema.items.type === "object" && schema.items.properties) {
      output += formatSchema(schema.items, indent);
    } else {
      output += schema.items.type;
      if (schema.items.enum) {
        output += ` (one of: ${schema.items.enum.join(", ")})`;
      }
    }
    output += ">";
  } else {
    output += schema.type;
    if (schema.enum) {
      output += ` (one of: ${schema.enum.join(", ")})`;
    }
    if (schema.format) {
      output += ` (${schema.format})`;
    }
  }

  return output;
}

// Helper function to format security requirements
function formatSecurity(security: Record<string, string[]>[]): string {
  if (!security || security.length === 0) return "";

  let output = "### Security\n\n";
  security.forEach((scheme) => {
    Object.entries(scheme).forEach(([name, scopes]) => {
      output += `* ${name}`;
      if (scopes.length > 0) {
        output += ` (scopes: ${scopes.join(", ")})`;
      }
      output += "\n";
    });
  });
  return output + "\n";
}

// Helper function to format operation parameters
function formatParameters(parameters: OpenapiParameterObject[]): string {
  if (!parameters || parameters.length === 0) return "";

  let output = "### Parameters\n\n";
  const groupedParams = parameters.reduce((acc, param) => {
    acc[param.in] = acc[param.in] || [];
    acc[param.in].push(param);
    return acc;
  }, {} as Record<string, OpenapiParameterObject[]>);

  for (const [location, params] of Object.entries(groupedParams)) {
    output += `#### ${
      location.charAt(0).toUpperCase() + location.slice(1)
    } Parameters\n\n`;
    for (const param of params) {
      output += `* \`${param.name}\`${param.required ? " (Required)" : ""}`;
      if (param.description) {
        output += `\n  ${param.description}`;
      }
      if (param.schema) {
        output += `\n  Type: ${formatSchema(param.schema)}`;
      }
      if (param.example) {
        output += `\n  Example: ${JSON.stringify(param.example)}`;
      }
      output += "\n\n";
    }
  }

  return output;
}

// Helper function to format operation responses
function formatResponses(
  responses: Record<string, OpenapiResponseObject>,
): string {
  let output = "### Responses\n\n";

  for (const [code, response] of Object.entries(responses)) {
    const statusText =
      {
        "200": "OK",
        "201": "Created",
        "204": "No Content",
        "400": "Bad Request",
        "401": "Unauthorized",
        "403": "Forbidden",
        "404": "Not Found",
        "500": "Internal Server Error",
      }[code] || "";

    output += `* **${code}** ${statusText}: ${
      response.description || "No description"
    }\n`;

    if (response.content) {
      for (const [contentType, content] of Object.entries(response.content)) {
        if (content.schema) {
          output += `\n  Content-Type: \`${contentType}\`\n\n`;
          output += `  Schema:\n  \`\`\`typescript\n  ${formatSchema(
            content.schema,
          )?.replace(/\n/g, "\n  ")}\n  \`\`\`\n`;
        }
        if (content.examples) {
          output += `\n  Examples:\n`;
          for (const [name, example] of Object.entries(content.examples)) {
            output += `  * ${name}:\n  \`\`\`json\n  ${JSON.stringify(
              example.value,
              null,
              2,
            )?.replace(/\n/g, "\n  ")}\n  \`\`\`\n`;
          }
        }
      }
    }
    output += "\n";
  }

  return output;
}

// Main function to generate documentation
export function generateApiDocs(doc: OpenapiDocument): string {
  let output = "";

  // Title and Info
  output += `# ${doc.info.title} ${doc.info.version}\n\n`;
  if (doc.info.description) {
    output += `${doc.info.description}\n\n`;
  }

  // Server information
  if (doc.servers && doc.servers.length > 0) {
    output += "## Servers\n\n";
    doc.servers.forEach((server) => {
      output += `* ${server.url}${
        server.description ? ` - ${server.description}` : ""
      }\n`;
    });
    output += "\n";
  }

  // Authentication
  if (doc.components?.securitySchemes) {
    output += "## Authentication\n\n";
    for (const [name, scheme] of Object.entries(
      doc.components.securitySchemes,
    )) {
      output += `### ${name}\n\n`;
      output += `Type: ${scheme.type}\n`;
      if (scheme.description) {
        output += `\n${scheme.description}\n`;
      }
      if (scheme.type === "oauth2" && scheme.flows) {
        output += "\nAvailable flows:\n\n";
        for (const [flowType, flow] of Object.entries(scheme.flows)) {
          if (flow) {
            output += `* ${flowType}\n`;
            output += `  * Authorization URL: ${flow.authorizationUrl}\n`;
            output += `  * Token URL: ${flow.tokenUrl}\n`;
            if (flow.scopes) {
              output += "  * Scopes:\n";
              for (const [scope, desc] of Object.entries(flow.scopes)) {
                output += `    * ${scope}: ${desc}\n`;
              }
            }
          }
        }
      }
      output += "\n";
    }
  }

  // Endpoints
  output += "## Endpoints\n\n";

  // Group endpoints by tags
  const taggedOperations: Record<
    string,
    { path: string; method: string; operation: OperationObject }[]
  > = {};

  for (const [path, pathItem] of Object.entries(doc.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!operation || typeof operation !== "object") continue;

      const tags = operation.tags || ["default"];
      tags.forEach((tag) => {
        taggedOperations[tag] = taggedOperations[tag] || [];
        taggedOperations[tag].push({ path, method, operation });
      });
    }
  }

  // Generate documentation for each tag group
  for (const [tag, operations] of Object.entries(taggedOperations)) {
    output += `### ${tag}\n\n`;

    for (const { path, method, operation } of operations) {
      output += `#### ${
        operation.operationId || `${method.toUpperCase()} ${path}`
      }\n\n`;

      if (operation.summary) {
        output += `${operation.summary}\n\n`;
      }
      if (operation.description) {
        output += `${operation.description}\n\n`;
      }

      output += `\`${method.toUpperCase()} ${path}\`\n\n`;

      if (operation.security) {
        output += formatSecurity(operation.security);
      }

      if (operation.parameters) {
        output += formatParameters(operation.parameters);
      }

      if (operation.requestBody) {
        output += "### Request Body\n\n";
        for (const [contentType, content] of Object.entries(
          operation.requestBody.content,
        )) {
          output += `Content-Type: \`${contentType}\`\n\n`;
          if (content.schema) {
            output += `Schema:\n\`\`\`typescript\n${formatSchema(
              content.schema,
            )}\n\`\`\`\n\n`;
          }
        }
      }

      if (operation.responses) {
        output += formatResponses(operation.responses);
      }

      output += "---\n\n";
    }
  }

  // Models/Schemas
  if (doc.components?.schemas) {
    output += "## Models\n\n";
    for (const [name, schema] of Object.entries(doc.components.schemas)) {
      output += `### ${name}\n\n`;
      output += `\`\`\`typescript\n${formatSchema(schema)}\n\`\`\`\n\n`;
    }
  }

  return output;
}

// Example usage
// Add a more complex sample with nested objects and arrays
const sampleDoc: OpenapiDocument = {
  info: {
    title: "Sample API",
    version: "1.0.0",
    description: "A sample API to demonstrate the man page conversion",
  },
  paths: {
    "/users": {
      post: {
        operationId: "createUser",
        summary: "Create a new user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "email"],
                properties: {
                  username: {
                    type: "string",
                    description: "The user's unique username",
                  },
                  email: {
                    type: "string",
                    format: "email",
                    description: "The user's email address",
                  },
                  profile: {
                    type: "object",
                    properties: {
                      firstName: {
                        type: "string",
                      },
                      lastName: {
                        type: "string",
                      },
                      age: {
                        type: "integer",
                        minimum: 0,
                      },
                      addresses: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            street: {
                              type: "string",
                            },
                            city: {
                              type: "string",
                            },
                            country: {
                              type: "string",
                              enum: ["US", "UK", "CA"],
                            },
                          },
                        },
                      },
                    },
                  },
                  settings: {
                    type: "object",
                    properties: {
                      theme: {
                        type: "string",
                        enum: ["light", "dark"],
                        default: "light",
                      },
                      notifications: {
                        type: "boolean",
                        default: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "User created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                      format: "uuid",
                    },
                    username: {
                      type: "string",
                    },
                    createdAt: {
                      type: "string",
                      format: "date-time",
                    },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid input",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    errors: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          field: {
                            type: "string",
                          },
                          message: {
                            type: "string",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

// // Generate man page
// console.log(generateApiDocs(sampleDoc));
