/// <reference types="@cloudflare/workers-types" />

import { parse } from "yaml";

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

/**
 * Validate if the provided content is a valid OpenAPI specification
 */
async function isValidOpenAPISpec(
  content: string,
  contentType: string,
): Promise<{ valid: boolean; contentType?: string }> {
  try {
    let data: any;
    let ct: string;

    try {
      data = JSON.parse(content);
      ct = "application/json";
    } catch (e) {
      try {
        data = parse(content);
        ct = "text/yaml";
      } catch {
        return { valid: false };
      }
    }

    // Basic OpenAPI validation
    return {
      valid:
        (data.openapi && typeof data.openapi === "string") ||
        (data.swagger && typeof data.swagger === "string"),
      contentType: ct,
    };
  } catch (e) {
    console.error("Error validating OpenAPI spec:", e);
    return { valid: false };
  }
}

/**
 * Check if a URL returns an OpenAPI specification
 */
export async function checkURL(url: string): Promise<{
  isValid: boolean;
  redirectUrl?: string;
  text?: string;
  contentType?: string;
}> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.log("ERRRRR", response.status);
      throw new Error(String("Err" + response.status));
    }

    const text = await response.text();

    const { valid, contentType } = await isValidOpenAPISpec(
      text,
      response.headers.get("Content-Type") || "",
    );

    console.log({ valid, contentType });
    return {
      isValid: valid,
      redirectUrl: valid ? url : undefined,
      text: valid ? text : undefined,
      contentType,
    };

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
