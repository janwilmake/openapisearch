import primary from "./providers.json";
//@ts-ignore
import homepage from "./homepage.html";
//@ts-ignore
import provider from "./provider.html";
import logo from "./logo";

/// <reference types="@cloudflare/workers-types" />

/**
 * OpenAPI Finder - Cloudflare Worker
 *
 * This worker takes a hostname in the pathname (e.g., npm.oapis.org) and
 * searches for valid OpenAPI specifications, redirecting to the first one found.
 * It also caches successful locations in KV for faster future lookups.
 */

// Define interface for environment variables
export interface Env {
  OPENAPI_LOCATIONS: KVNamespace;
}

// List of common paths to check for OpenAPI specifications
const OPENAPI_PATHS = [
  // Root paths
  "/openapi.json",
  "/openapi.yaml",
  "/openapi.yml",

  // Well-known paths
  "/.well-known/openapi",
  "/.well-known/openapi.json",
  "/.well-known/openapi.yaml",
  "/.well-known/openapi.yml",
  "/.well-known/api-description.json",
  "/.well-known/api-description.yaml",
  "/.well-known/api-description.yml",

  // API paths
  "/api/openapi.json",
  "/api/openapi.yaml",
  "/api/openapi.yml",
  "/api/v1/openapi.json",
  "/api/v1/openapi.yaml",
  "/api/v1/openapi.yml",

  // Documentation paths
  "/docs/openapi.json",
  "/docs/openapi.yaml",
  "/docs/openapi.yml",
  "/api-docs/openapi.json",
  "/api-docs/openapi.yaml",
  "/api-docs/openapi.yml",
  "/swagger/openapi.json",
  "/swagger/openapi.yaml",
  "/swagger/openapi.yml",

  // Version-specific paths
  "/v3/openapi.json",
  "/v3/openapi.yaml",
  "/v3/openapi.yml",
  "/v2/openapi.json",
  "/v2/openapi.yaml",
  "/v2/openapi.yml",
  "/v1/openapi.json",
  "/v1/openapi.yaml",
  "/v1/openapi.yml",

  // Common naming variations
  "/swagger.json",
  "/swagger.yaml",
  "/swagger.yml",
  "/api-specification.json",
  "/api-specification.yaml",
  "/api-specification.yml",
];

// Maximum size to read for validation (100KB)
const MAX_VALIDATION_SIZE = 100 * 1024;
/**
 * Efficiently checks if the content is an OpenAPI specification by examining only the first part
 * Uses regex to find OpenAPI identifiers without parsing the entire file
 */
function isOpenAPISpecByPartialCheck(content: string): {
  valid: boolean;
  contentType?: string;
} {
  // Check for JSON format OpenAPI identifiers
  const jsonOpenapiRegex = /"openapi"\s*:\s*"[^"]+"/i;
  const jsonSwaggerRegex = /"swagger"\s*:\s*"[^"]+"/i;
  const jsonPathsRegex = /"paths"\s*:\s*\{/i;
  const jsonComponentsRegex = /"components"\s*:\s*\{/i;

  // Check for YAML format OpenAPI identifiers
  const yamlOpenapiRegex = /openapi\s*:\s*["']?[\d\.]+["']?/i;
  const yamlSwaggerRegex = /swagger\s*:\s*["']?[\d\.]+["']?/i;
  const yamlPathsRegex = /paths\s*:/i;
  const yamlComponentsRegex = /components\s*:/i;

  // Check if content contains primary OpenAPI identifiers (openapi or swagger)
  const hasJsonPrimaryIdentifier =
    jsonOpenapiRegex.test(content) || jsonSwaggerRegex.test(content);
  const hasYamlPrimaryIdentifier =
    yamlOpenapiRegex.test(content) || yamlSwaggerRegex.test(content);

  // Check if content contains secondary OpenAPI identifiers (paths or components)
  const hasJsonSecondaryIdentifier =
    jsonPathsRegex.test(content) || jsonComponentsRegex.test(content);
  const hasYamlSecondaryIdentifier =
    yamlPathsRegex.test(content) || yamlComponentsRegex.test(content);

  // If it has primary identifiers or both secondary identifiers, consider it valid
  if (
    hasJsonPrimaryIdentifier ||
    (hasJsonSecondaryIdentifier && content.trim().startsWith("{"))
  ) {
    return { valid: true, contentType: "application/json" };
  } else if (hasYamlPrimaryIdentifier || hasYamlSecondaryIdentifier) {
    return { valid: true, contentType: "text/yaml" };
  }

  return { valid: false };
}
/**
 * Check if a URL returns an OpenAPI specification using partial validation
 * Only examines the first 100KB of the file
 */
export async function checkURL(url: string): Promise<{
  isValid: boolean;
  redirectUrl?: string;
  text?: string;
  contentType?: string;
}> {
  try {
    // Fetch the response with no-cors mode to ensure we can access the content
    const response = await fetch(url);

    if (!response.ok) {
      return { isValid: false };
    }

    // Use a ReadableStream to process only the beginning of the file
    const reader = response.body?.getReader();
    if (!reader) {
      return { isValid: false };
    }

    let bytesRead = 0;
    let contentChunks: Uint8Array<ArrayBufferLike>[] = [];
    let done = false;
    let firstChunk = "";

    // Read up to MAX_VALIDATION_SIZE bytes for validation
    while (!done && bytesRead < MAX_VALIDATION_SIZE) {
      const result = await reader.read();
      done = result.done;

      if (result.value) {
        bytesRead += result.value.length;
        contentChunks.push(result.value);

        // If this is our first chunk, decode it for validation
        if (contentChunks.length === 1) {
          const decoder = new TextDecoder();
          firstChunk = decoder.decode(result.value, { stream: true });
        }
      }
    }

    // Cancel the read stream - we don't need more data for validation
    reader.cancel();

    // Check if the first chunk contains OpenAPI identifiers
    const { valid, contentType } = isOpenAPISpecByPartialCheck(firstChunk);

    if (valid) {
      // If valid and we need the full text, fetch it again
      let fullText;
      // We'll fetch the full content only when needed
      try {
        const fullResponse = await fetch(url);
        fullText = await fullResponse.text();
      } catch (e) {
        console.error(`Error fetching full content from ${url}:`, e);
        // If we can't get the full text, just use what we have
        const decoder = new TextDecoder();
        fullText = contentChunks
          .map((chunk) => decoder.decode(chunk, { stream: true }))
          .join("");
      }

      return {
        isValid: true,
        redirectUrl: url,
        text: fullText,
        contentType,
      };
    }

    return { isValid: false };
  } catch (e) {
    console.error(`Error checking URL ${url}:`, e);
    return { isValid: false };
  }
}

export const findCachedOpenapiUrl = async (env: Env, hostname: string) => {
  // Check if we have a cached location for this hostname
  const cachedLocation = await env.OPENAPI_LOCATIONS.get(hostname);
  if (cachedLocation) {
    console.log({ cachedLocation });
    // Verify the cached location still works
    const { isValid, redirectUrl, text, contentType } = await checkURL(
      cachedLocation,
    );
    if (isValid && redirectUrl) {
      return { redirectUrl, text, contentType };
    }
    // If not valid anymore, remove from cache
    await env.OPENAPI_LOCATIONS.delete(hostname);
  }

  // Try all potential OpenAPI paths
  for (const path of OPENAPI_PATHS) {
    const targetUrl = `https://${hostname}${path}`;

    console.log(`Checking: ${targetUrl}`);

    const { isValid, redirectUrl, text, contentType } = await checkURL(
      targetUrl,
    );

    if (isValid && redirectUrl) {
      // Cache this successful location
      await env.OPENAPI_LOCATIONS.put(hostname, redirectUrl, {
        expirationTtl: 86400 * 30,
      });

      // Redirect to the found OpenAPI spec
      return { redirectUrl, text, contentType };
    }
  }

  // If we get here, we couldn't find a valid OpenAPI spec
  return null;
};

// Set CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Gets the metaview object containing provider information
 */
export const getMetaviewObject = () => {
  const metaviewObject = Object.entries(primary.providers).reduce(
    (obj, [key, item]) => {
      if (typeof item !== "object" || !("openapiUrl" in item)) {
        return obj;
      }
      return {
        ...obj,
        [key]: {
          description: (item as any)?.info?.description,
          openapiUrl: item.openapiUrl,
        },
      };
    },
    {} as {
      [slug: string]: { description: string | undefined; openapiUrl: string };
    },
  );
  return metaviewObject;
};

/**
 * Handles requests to the /metaview endpoint
 */
export const getMetaview = async (request: Request) => {
  const accept =
    new URL(request.url).searchParams.get("accept") ||
    request.headers.get("accept");
  const metaviewObject = getMetaviewObject();

  if (accept?.includes("application/json")) {
    return new Response(JSON.stringify(metaviewObject, undefined, 2), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const md = Object.entries(metaviewObject)
    .map(
      ([key, value]) =>
        `- ${key}${value.description ? ` - ${value.description}` : ""}`,
    )
    .join("\n");

  return new Response(md, { headers: { "content-type": "text/markdown" } });
};

/**
 * Gets a valid openapi url based on the pathname in several ways
 *
 * 1) checks hardcoded
 * 2) checks provided URL
 * 3) explores a provided hostname
 */
export const getValidOpenapiUrl = async (request: Request, env: Env) => {
  const url = new URL(request.url);
  const providerSlug = url.pathname.split("/").slice(2).join("/");
  const metaviewObject = getMetaviewObject();
  const hardcodedUrl = metaviewObject[providerSlug]?.openapiUrl;

  if (hardcodedUrl) {
    const { isValid, redirectUrl, text, contentType } = await checkURL(
      hardcodedUrl,
    );

    // Hardcoded first
    if (isValid) {
      return { redirectUrl, text, contentType };
    }
  }

  const asUrl = providerSlug.includes("__")
    ? providerSlug.replaceAll("__", "/")
    : providerSlug.includes("/")
    ? providerSlug
    : decodeURIComponent(providerSlug).includes("/")
    ? decodeURIComponent(providerSlug)
    : undefined;

  if (asUrl) {
    // it's already an URL
    try {
      new URL(asUrl);

      const { isValid, redirectUrl, text, contentType } = await checkURL(asUrl);

      if (isValid) {
        return { redirectUrl, text, contentType };
      }
    } catch {}
  }

  const noTld = providerSlug.split(".").length === 1;
  const hostname = noTld ? providerSlug + ".com" : providerSlug;
  const found = await findCachedOpenapiUrl(env, hostname);
  if (found) {
    const { redirectUrl, text, contentType } = found;
    return { redirectUrl, text, contentType };
  }
};

/**
 * Main handler function for the Cloudflare Worker
 */
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    // Handle OPTIONS requests for CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const accept = request.headers.get("accept");
    // Route requests based on the path
    const isRedirect = path.startsWith("/redirect/");

    if (path.startsWith("/logo/")) {
      return logo.fetch(request, env);
    }

    if (path === "/" || path.startsWith("/index.")) {
      if (accept?.includes("text/html") && path !== "/index.md") {
        return new Response(homepage, {
          headers: { "content-type": "text/html;charset=utf8" },
        });
      }

      return await getMetaview(request);
    }

    if (path.startsWith("/redirect/") || path.startsWith("/openapi/")) {
      const finalOpenapiUrl = await getValidOpenapiUrl(request, env);

      if (
        !finalOpenapiUrl?.contentType ||
        !finalOpenapiUrl?.redirectUrl ||
        !finalOpenapiUrl?.text
      ) {
        return new Response(
          "Not found. Ensure to follow the {providerId} convention described in our openapi: https://openapisearch.com/openapi.json",
          { status: 404 },
        );
      }

      const { redirectUrl, text, contentType } = finalOpenapiUrl;

      if (isRedirect) {
        return new Response(redirectUrl, {
          status: 307,
          headers: { Location: redirectUrl },
        });
      }

      return new Response(text, {
        status: 200,
        headers: { "Content-Type": contentType, ...corsHeaders },
      });
    }
    const segments = url.pathname.split("/").slice(1);

    if (segments.length === 1) {
      // For the /{providerId} endpoint
      const providerId = url.pathname.slice(1);

      // HTML template for the landing page
      const renderedPage = provider
        .replace(/\{\{providerId\}\}/g, providerId)
        .replace(/\{\{name\}\}/g, providerId)
        .replace(
          /\{\{title\}\}/g,
          `LLM Context for ${decodeURIComponent(providerId)} API`,
        )
        .replace(
          /\{\{description\}\}/g,
          `Easy LLM Context for any API. OpenAPI Search makes APIs Accessible for AI Codegen and tool use!`,
        );

      // Return the landing page HTML
      return new Response(renderedPage, {
        headers: { "Content-Type": "text/html;charset=utf8" },
      });
    }

    // Return 404 for any other routes
    return new Response(
      "This is not a valid openapi path or providerId. Please go to the landingpage and fill in your OpenAPI there.",
      { status: 404 },
    );
  },
};
