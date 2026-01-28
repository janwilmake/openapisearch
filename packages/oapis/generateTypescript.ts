import { OpenapiDocument, Operation, Parameter, JSONSchema } from "./types";

function getBaseUrl(openapiUrl: string, server?: { url: string }): string {
  // Try to get base URL from servers array first
  if (server) {
    try {
      // Check if it's a valid URL
      new URL(server.url);
      return server.url.replace(/\/$/, ""); // Remove trailing slash if present
    } catch (e) {
      // If not a valid URL, it might be a relative path - ignore
    }
  }

  // Fallback to openapiUrl origin
  try {
    const url = new URL(openapiUrl);
    return url.origin;
  } catch (e) {
    throw new Error(
      "Unable to determine base URL from either servers or openapiUrl",
    );
  }
}

function jsonSchemaToTS(schema: JSONSchema, indentLevel = 1): string {
  if (!schema) return "any";

  const indent = "  ".repeat(indentLevel);

  if (schema.$ref) {
    // Handle references - in a full implementation, you'd resolve these
    return schema.$ref.split("/").pop() || "any";
  }

  if (schema.enum) {
    return schema.enum
      .map((value) => (typeof value === "string" ? `"${value}"` : value))
      .join(" | ");
  }

  if (schema.oneOf) {
    return schema.oneOf.map((s) => jsonSchemaToTS(s, indentLevel)).join(" | ");
  }

  if (schema.anyOf) {
    return schema.anyOf.map((s) => jsonSchemaToTS(s, indentLevel)).join(" | ");
  }

  if (schema.allOf) {
    return schema.allOf.map((s) => jsonSchemaToTS(s, indentLevel)).join(" & ");
  }

  switch (schema.type) {
    case "object": {
      if (!schema.properties) return "{ [key: string]: any }";

      const requiredProps = schema.required || [];
      const properties = Object.entries(schema.properties)
        .map(([key, prop]) => {
          const isRequired = requiredProps.includes(key);
          const typeStr = jsonSchemaToTS(prop, indentLevel + 1);
          const description = prop.description
            ? `\n${indent}/** ${prop.description} */\n${indent}`
            : "";
          return `${description}"${key}"${isRequired ? "" : "?"}: ${typeStr};`;
        })
        .join(`\n${indent}`);

      return `{\n${indent}${properties}\n${indent.slice(2)}}`;
    }

    case "array":
      return `Array<${jsonSchemaToTS(schema.items || {}, indentLevel)}>`;

    case "string":
      return schema.nullable ? "string | null" : "string";

    case "number":
    case "integer":
      return schema.nullable ? "number | null" : "number";

    case "boolean":
      return schema.nullable ? "boolean | null" : "boolean";

    case "null":
      return "null";

    default:
      return "any";
  }
}

export function generateTypeScript(
  openapi: OpenapiDocument,
  method: string,
  operation: Operation,
  path: string,
  openapiUrl: string,
  isExported?: boolean,
): string {
  const baseUrl = getBaseUrl(
    openapiUrl,
    operation.servers?.[0] || openapi.servers?.[0],
  );

  // Generate parameter types
  const parameters: Parameter[] = operation.parameters || [];

  const headerParams = parameters.filter((p) => p.in === "header");
  const queryParams = parameters.filter((p) => p.in === "query");
  const pathParams = parameters.filter((p) => p.in === "path");
  const requestBody =
    operation.requestBody?.content?.["application/json"]?.schema;

  // Build request type properties
  const requestProperties: string[] = [];

  if (headerParams.length) {
    requestProperties.push(
      `headers: ${jsonSchemaToTS({
        type: "object",
        required: headerParams.filter((p) => p.required).map((p) => p.name),
        properties: Object.fromEntries(
          headerParams.map((p) => [
            p.name,
            { ...p.schema, description: p.description },
          ]),
        ),
      })}`,
    );
  }

  if (queryParams.length) {
    requestProperties.push(
      `query: ${jsonSchemaToTS({
        type: "object",
        required: queryParams.filter((p) => p.required).map((p) => p.name),
        properties: Object.fromEntries(
          queryParams.map((p) => [
            p.name,
            { ...p.schema, description: p.description },
          ]),
        ),
      })}`,
    );
  }

  if (pathParams.length) {
    requestProperties.push(
      `path: ${jsonSchemaToTS({
        type: "object",
        required: pathParams.map((p) => p.name), // All path parameters are required
        properties: Object.fromEntries(
          pathParams.map((p) => [
            p.name,
            { ...p.schema, description: p.description },
          ]),
        ),
      })}`,
    );
  }

  if (requestBody) {
    requestProperties.push(`body: ${jsonSchemaToTS(requestBody)}`);
  }

  // Generate response type
  const successResponse = operation.responses?.["200"];
  const mediaTypes = successResponse?.content
    ? Object.keys(successResponse.content)
    : [];
  const isJson = mediaTypes.includes("application/json");
  const responseBody =
    successResponse?.content?.[isJson ? "application/json" : mediaTypes[0]]
      ?.schema;

  const responseHeaders = successResponse?.headers;

  // Generate response headers type with proper typing for known headers
  let responseHeadersType = "Record<string, string>";
  if (responseHeaders) {
    const headerProperties = Object.entries(responseHeaders).reduce(
      (acc, [name, header]: [string, any]) => {
        const headerName = name.toLowerCase(); // HTTP headers are case-insensitive
        const schema = header.schema || { type: "string" };
        const description = header.description
          ? `/** ${header.description} */\n  `
          : "";
        return (
          acc + `${description}"${headerName}": ${jsonSchemaToTS(schema)};\n  `
        );
      },
      "",
    );

    responseHeadersType = `{
  ${headerProperties}
  // Allow additional string headers
  [key: string]: string | number | boolean | undefined;
}`;
  }

  const code = `
/**
 * Generated Types for ${path}
 */

${
  requestProperties.length
    ? `type RequestType = {
  ${requestProperties.join(";\n  ")};
};`
    : "type RequestType = Record<string, never>;"
}

type ResponseType = {
  status: number;
  headers: ${responseHeadersType};
  body: ${responseBody ? jsonSchemaToTS(responseBody) : "void"};
};

/**
 * Makes a request to ${path}
 * @param request The request parameters
 * @returns A promise that resolves to the response
 */
${
  isExported ? "export default" : ""
} async function makeRequest(request: RequestType): Promise<ResponseType> {
  // Build URL with path parameters
  let url = "${baseUrl}${path}";
  ${
    pathParams.length
      ? `
  Object.entries(request.path).forEach(([key, value]) => {
    url = url.replace(\`{\${key}\`, encodeURIComponent(String(value)));
  });`
      : ""
  }

  ${
    queryParams.length
      ? `
  // Add query parameters
  const queryParams = new URLSearchParams();
  Object.entries(request.query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  });
  const queryString = queryParams.toString();
  if (queryString) {
    url += "?" + queryString;
  }`
      : ""
  }

  // Make the request
  const response = await fetch(url, {
    method: "${method.toUpperCase()}",
    ${headerParams.length ? "headers: request.headers," : ""}
    ${requestBody ? "body: JSON.stringify(request.body)," : ""}
  });

  // Parse response
  const responseBody = ${
    isJson ? "await response.json()" : "await response.text()"
  };

  // Convert headers to typed object
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key.toLowerCase()] = value;
  });

  return {
    status: response.status,
    headers: responseHeaders as ResponseType['headers'],
    body: responseBody,
  };
}
`;

  return code;
}
