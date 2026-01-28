interface OpenapiDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: {
    [path: string]: {
      [method: string]: {
        summary?: string;
        description?: string;
        parameters?: Array<{
          name: string;
          in: string;
          description?: string;
          required?: boolean;
          schema?: {
            type: string;
            format?: string;
          };
        }>;
        requestBody?: {
          description?: string;
          content: {
            [contentType: string]: {
              schema: {
                type: string;
                properties?: {
                  [property: string]: {
                    type: string;
                    description?: string;
                  };
                };
              };
            };
          };
        };
        responses: {
          [statusCode: string]: {
            description: string;
            content?: {
              [contentType: string]: {
                schema: {
                  type: string;
                  properties?: {
                    [property: string]: {
                      type: string;
                      description?: string;
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
  };
}

export function convertOpenapiToMarkdown(doc: OpenapiDocument): string {
  let markdown = "";

  // Add title and version
  markdown += `# ${doc.info.title}\n\n`;
  markdown += `API Version: ${doc.info.version}\n\n`;

  // Add description if available
  if (doc.info.description) {
    markdown += `${doc.info.description}\n\n`;
  }

  // Process each path
  Object.entries(doc.paths).forEach(([path, pathItem]) => {
    markdown += `## ${path}\n\n`;

    // Process each method for the path
    Object.entries(pathItem).forEach(([method, operation]) => {
      markdown += `### ${method.toUpperCase()}\n\n`;

      if (operation.summary) {
        markdown += `**Summary:** ${operation.summary}\n\n`;
      }

      if (operation.description) {
        markdown += `${operation.description}\n\n`;
      }

      // Parameters section
      if (operation.parameters && operation.parameters.length > 0) {
        markdown += `#### Parameters\n\n`;
        markdown += `| Name | Located In | Description | Required | Type |\n`;
        markdown += `| ---- | ---------- | ----------- | -------- | ---- |\n`;

        operation.parameters.forEach((param) => {
          const required = param.required ? "Yes" : "No";
          const type = param.schema ? param.schema.type : "N/A";
          const description = param.description || "N/A";
          markdown += `| ${param.name} | ${param.in} | ${description} | ${required} | ${type} |\n`;
        });
        markdown += "\n";
      }

      // Request Body section
      if (operation.requestBody) {
        markdown += `#### Request Body\n\n`;
        if (operation.requestBody.description) {
          markdown += `${operation.requestBody.description}\n\n`;
        }

        Object.entries(operation.requestBody.content).forEach(
          ([contentType, content]) => {
            markdown += `**Content Type:** ${contentType}\n\n`;
            if (content.schema.properties) {
              markdown += `| Property | Type | Description |\n`;
              markdown += `| -------- | ---- | ----------- |\n`;

              Object.entries(content.schema.properties).forEach(
                ([propName, prop]) => {
                  markdown += `| ${propName} | ${prop.type} | ${
                    prop.description || "N/A"
                  } |\n`;
                },
              );
              markdown += "\n";
            }
          },
        );
      }

      // Responses section
      markdown += `#### Responses\n\n`;
      Object.entries(operation.responses).forEach(([statusCode, response]) => {
        markdown += `**${statusCode}**: ${response.description}\n\n`;

        if (response.content) {
          Object.entries(response.content).forEach(([contentType, content]) => {
            markdown += `Content Type: ${contentType}\n\n`;
            if (content.schema.properties) {
              markdown += `| Property | Type | Description |\n`;
              markdown += `| -------- | ---- | ----------- |\n`;

              Object.entries(content.schema.properties).forEach(
                ([propName, prop]) => {
                  markdown += `| ${propName} | ${prop.type} | ${
                    prop.description || "N/A"
                  } |\n`;
                },
              );
              markdown += "\n";
            }
          });
        }
      });

      markdown += "---\n\n";
    });
  });

  return markdown;
}
