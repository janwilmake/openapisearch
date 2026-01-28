import { dereferenceSync } from "@trojs/openapi-dereference";
import { load, dump } from "js-yaml";
import { generateTypeScript } from "./generateTypescript.js";
import { deref } from "./deref.js";
import { generateApiDocs } from "./summary.js";
import { OpenapiDocument, PathItem } from "./types.js";
import { getOperations } from "./getOperations.js";
import { generateOverview } from "./generateOverview.js";

/** NB: Not sure on the ratelimit on this, or logging */
export const convertSwaggerToOpenapi = async (swaggerUrl: string) => {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 10000);
  const result = await fetch(
    `https://converter.swagger.io/api/convert?url=${swaggerUrl}`,
    { signal: abortController.signal },
  )
    .then((res) => res.json() as Promise<OpenapiDocument>)
    .catch((e) => {
      return undefined;
    });

  clearTimeout(timeoutId);

  return result;
};

const matchOperation = (openapi: OpenapiDocument, url: URL) => {
  if (!openapi.paths) {
    return;
  }

  // First try direct path match
  const directMatch = openapi.paths[url.pathname]?.get;
  if (directMatch) {
    return {
      operation: directMatch,
      originalPath: url.pathname,
      method: "GET",
    };
  }

  const normalizedPathname = url.pathname.slice(1) as keyof PathItem;

  // Then try operationId match
  for (const [path, pathItem] of Object.entries(openapi.paths)) {
    // Check if any method's operationId matches the pathname
    const matchingMethod = ["get", "post", "put", "patch", "delete"].find(
      (httpMethod) => {
        const operation = pathItem?.[httpMethod as keyof typeof pathItem];
        return operation?.operationId === normalizedPathname;
      },
    );

    if (matchingMethod) {
      return {
        operation: pathItem[matchingMethod as keyof typeof pathItem],
        originalPath: path,
        method: matchingMethod.toUpperCase(),
      };
    }
  }

  // Finally try regex path matching
  const pathPatterns = Object.keys(openapi.paths).map((path) => {
    const foundMethod = ["get", "post", "delete", "patch", "put"].find(
      (m) => (openapi.paths[path] as any)?.[m],
    );

    if (!foundMethod) {
      return;
    }

    return {
      pattern: convertPathToRegex(path),
      operation: (openapi.paths[path] as any)![foundMethod],
      method: foundMethod?.toUpperCase(),
      originalPath: path,
    };
  });

  const match = pathPatterns
    .filter((x) => !!x)
    .find(({ pattern }) => pattern.test(url.pathname));

  return match;
};

const convertPathToRegex = (path: string): RegExp => {
  // Replace path parameters {param} with regex capture groups
  const regexPattern = path
    // Escape forward slashes
    .replace(/\//g, "\\/")
    // Replace path parameters with regex capture groups
    .replace(/\{([^}]+)\}/g, "([^/]+)")
    // Add start and end anchors
    .replace(/^/, "^")
    .replace(/$/, "$");

  return new RegExp(regexPattern);
};

/**
 * try-catches js-yaml to turn the yamlString into JSON
 */
export const tryParseYamlToJson = <T = any>(yamlString: string): T | null => {
  try {
    const document = load(yamlString);
    return document as T;
  } catch (e: any) {
    return null;
  }
};

const removeCommentsRegex = /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g;

/**
 * if text isn't json, returns null
 */
export const tryParseJson = <T extends unknown>(
  text: string,
  logParseError?: boolean,
): T | null => {
  try {
    const jsonStringWithoutComments = text.replace(
      removeCommentsRegex,
      (m, g) => (g ? "" : m),
    );
    return JSON.parse(jsonStringWithoutComments) as T;
  } catch (parseError) {
    if (logParseError) console.log("JSON Parse error:", parseError);
    return null;
  }
};

/**
 * Get a subset of the OpenAPI document for a specific route
 */
const getOpenAPISubset = (openapi: OpenapiDocument, route: string) => {
  if (!route || !openapi.paths) {
    return openapi;
  }

  const matchingPaths: Record<string, any> = {};

  // Match by path or operationId
  for (const [path, pathItem] of Object.entries(openapi.paths)) {
    if (path === route) {
      matchingPaths[path] = pathItem;
      break;
    }

    for (let method of ["get", "post", "put", "delete", "patch"]) {
      if (pathItem?.[method as keyof typeof pathItem]?.operationId === route) {
        if (!matchingPaths[path]) {
          matchingPaths[path] = {};
        }
        matchingPaths[path][method] =
          pathItem?.[method as keyof typeof pathItem];
      }
    }
  }

  const newOpenapi = {
    ...openapi,
    paths: matchingPaths,
  };

  try {
    const { tags, webhooks, components, ...dereferenced } = dereferenceSync(
      newOpenapi,
    ) as OpenapiDocument;
    return dereferenced;
  } catch {
    return { error: "Could not deref", ...newOpenapi };
  }
};

const searchOpenapi = async (providerId: string) => {
  const urlResponse = await fetch(
    `https://openapisearch.com/redirect/${providerId}`,
    { redirect: "follow" },
  );
  if (!urlResponse.ok) {
    console.log("Not ok", providerId);
    return;
  }
  const openapiUrl = urlResponse.url;

  const res = await fetch(openapiUrl);
  if (!res.ok) {
    console.log("Not ok", openapiUrl);
    return;
  }

  const text = await res.text();

  let json = undefined;

  try {
    json = JSON.parse(text);
  } catch (e) {
    try {
      json = load(text);
    } catch (e) {
      return;
    }
  }
  const basePath = json.servers?.[0]?.url || new URL(openapiUrl).hostname;
  return { openapiUrl, openapiJson: json, basePath };
};

export default {
  fetch: async (request: Request) => {
    // Set CORS headers for all responses
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle OPTIONS requests for CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);
    const accept =
      request.headers.get("accept") || url.searchParams.get("accept");

    const [type, hostname, ...rest] = url.pathname.split("/").slice(1);
    const route = rest.length ? "/" + rest.join("/") + url.search : "";

    if (
      ![
        "request",
        "response",
        "summary",
        "openapi",
        "ts",
        "cjs",
        "esm",
        "operations",
        "overview",
        "slop",
        "llms.txt",
        "skills",
      ].includes(type) ||
      !hostname
    ) {
      return new Response(
        `Please use the format /[type]/[hostname]/[idOrRoute]`,
        { status: 400 },
      );
    }

    const openapi = await searchOpenapi(hostname);

    if (!openapi) {
      return new Response("No OpenAPI found at " + hostname, { status: 404 });
    }

    console.log("HAS OAS");

    const { openapiUrl, openapiJson, basePath } = openapi;
    if (!openapiJson) {
      return new Response("No OpenAPI JSON found", { status: 404 });
    }

    try {
      const isSwagger =
        (openapiJson as any)?.swagger ||
        !openapiJson?.openapi ||
        !openapiJson?.openapi.startsWith("3.");

      const convertedOpenapi = isSwagger
        ? await convertSwaggerToOpenapi(openapiUrl)
        : (openapiJson as OpenapiDocument);

      if (!convertedOpenapi?.openapi) {
        return new Response("conversion failed", { status: 404 });
      }

      // Handle openapi type separately
      if (type === "openapi") {
        const subset = getOpenAPISubset(convertedOpenapi, route.slice(1)); // Remove leading slash

        if (accept === "application/json") {
          return new Response(JSON.stringify(subset, undefined, 2), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(dump(subset), {
          status: 200,
          headers: { "Content-Type": "text/yaml" },
        });
      }

      if (type === "overview" || type === "slop" || type === "llms.txt") {
        const subset = getOpenAPISubset(convertedOpenapi, route.slice(1));
        const overview = generateOverview(hostname, subset);
        return new Response(overview, {
          status: 200,
          headers: { "content-type": "text/markdown", ...corsHeaders },
        });
      }

      if (type === "skills") {
        const subset = getOpenAPISubset(convertedOpenapi, route.slice(1));
        const skills = generateOverview(hostname, subset, "skills");
        return new Response(skills, {
          status: 200,
          headers: { "content-type": "text/markdown", ...corsHeaders },
        });
      }

      if (type === "operations") {
        const subset = getOpenAPISubset(convertedOpenapi, route.slice(1)); // Remove leading slash

        const operations = getOperations(subset as any, openapiUrl, openapiUrl);

        if (!operations) {
          return new Response("Could not convert openapi to operations", {
            status: 500,
          });
        }
        return new Response(JSON.stringify(operations, undefined, 2), {
          status: 200,
          headers: { "content-type": "application/json", ...corsHeaders },
        });
      }

      if (type === "summary") {
        const dereferenced = getOpenAPISubset(convertedOpenapi, route.slice(1));
        return new Response(generateApiDocs(dereferenced as OpenapiDocument), {
          headers: corsHeaders,
        });
      }

      const operationIds = Object.values(convertedOpenapi.paths)
        .map((item) =>
          [
            item.get?.operationId,
            item.post?.operationId,
            item.delete?.operationId,
            item.put?.operationId,
            item.patch?.operationId,
          ]
            .filter(Boolean)
            .map((x) => x!),
        )
        .flat();
      const routes = Object.keys(convertedOpenapi.paths);

      // Handle other types
      const fullRequestUrl = `https://${basePath}${route}`;
      const op = matchOperation(convertedOpenapi, new URL(fullRequestUrl));
      console.log({ op });
      if (!op?.operation) {
        return new Response(
          `Operation wasn't found. Please specify a operation using an operationId or route
          
The available IDs are: 
${operationIds.map((x) => `- ${x}`).join("\n")}

The routes are:
${routes.map((x) => `- ${x}`).join("\n")}`,
          { status: 404, headers: corsHeaders },
        );
      }

      if (type === "ts") {
        // first take the openapi and parse it in a way such that we have the input type and response type as a JSON with JSON schemas
        // then, it should generate types:
        // type RequestType = { headers:{[name:string]:string}, query:{[name:string]:string}, path:{[name:string]:string}, body:{[name:string]:any} }
        // type ResponseType = { status:number; headers: {[name:string]:string}, body:any }
        // should generate a JS-only (web standard, no node) typescript file that has the types a default export of (request:RequestType)=>Promise<ResponseType> that fetches the OpenAPI in the right way

        const typescript = generateTypeScript(
          convertedOpenapi,
          op.method,
          op.operation,
          op.originalPath,
          openapiUrl,
          true,
        );
        return new Response(typescript, {
          status: 200,
          headers: { "Content-Type": "text/typescript", ...corsHeaders },
        });
      }

      if (type === "esm") {
        const typescript = generateTypeScript(
          convertedOpenapi,
          op.method,
          op.operation,
          op.originalPath,
          openapiUrl,
          true,
        );

        const javascript = (
          await fetch("https://swcapi.com/swc/strip-types", {
            method: "POST",
            body: JSON.stringify([typescript]),
          }).then((res) => res.json())
        )?.[0] as string;

        return new Response(javascript, {
          status: 200,
          headers: { "Content-Type": "text/javascript", ...corsHeaders },
        });

        // Same as ts but types stripped
      }

      if (type === "cjs") {
        const typescript = generateTypeScript(
          convertedOpenapi,
          op.method,
          op.operation,
          op.originalPath,
          openapiUrl,
        );

        const javascript = (
          await fetch("https://swcapi.com/swc/strip-types?cjs=true", {
            method: "POST",
            body: JSON.stringify([typescript]),
          }).then((res) => res.json())
        )?.[0] as string;

        return new Response(javascript, {
          status: 200,
          headers: { "Content-Type": "text/javascript", ...corsHeaders },
        });

        // Same as ts but types stripped
      }

      const json =
        type === "response"
          ? await deref(
              (
                (await deref(
                  op.operation.responses?.["200"],
                  openapiUrl,
                )) as any
              )?.content?.["application/json"]?.schema,
              openapiUrl,
            )
          : {
              path: op.originalPath,
              parameters: await deref(
                op.operation.parameters || [],
                openapiUrl,
              ),
            };

      if (!json) {
        return new Response(`not found`, { status: 404 });
      }

      if (accept === "text/yaml") {
        return new Response(dump(json), {
          status: 200,
          headers: { "Content-Type": "text/yaml" },
        });
      }

      return new Response(JSON.stringify(json, undefined, 2), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response("Couldn't parse OpenAPI; " + e.message, {
        status: 400,
      });
    }
  },
};
