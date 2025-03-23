import primary from "./providers.json";
//@ts-ignore
import homepage from "./homepage.html";
//@ts-ignore
import provider from "./provider.html";
import { checkURL, Env, findCachedOpenapiUrl } from "./findCachedOpenapiUrl";

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
 * 2) checks github repo
 * 3) checks provided URL
 * 4) explores a provided hostname
 */
const getValidOpenapiUrl = async (request: Request, env: Env) => {
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

  if (providerSlug.match(/github\.com\/([^\/]+)\/([^\/]+)/)) {
    const [, owner, repo] = providerSlug.split("/");

    const githubOpenapiResponse = await fetch(
      `https://openapi.zipobject.com/github.com/${owner}/${repo}`,
    );
    const isValid = githubOpenapiResponse.ok;

    if (!isValid) {
      return;
    }

    const redirectUrl = githubOpenapiResponse.url;
    const contentType = githubOpenapiResponse.headers.get("content-type");
    const text = await githubOpenapiResponse.text();

    return { redirectUrl, text, contentType };
  }

  const asUrl = providerSlug.includes("__")
    ? providerSlug.replaceAll("__", "/")
    : providerSlug.includes("/")
    ? providerSlug
    : decodeURIComponent(providerSlug).includes("/")
    ? decodeURIComponent(providerSlug)
    : undefined;

  if (asUrl) {
    try {
      new URL(asUrl);

      const { isValid, redirectUrl, text, contentType } = await checkURL(asUrl);

      if (isValid) {
        return { redirectUrl, text, contentType };
      }
    } catch {}
  }

  const noTld = providerSlug.split(".").length === 0;
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

    if (url.pathname.split("/").length === 2) {
      // For the /{providerId} endpoint
      const providerId = url.pathname.slice(1);

      // HTML template for the landing page
      const renderedPage = provider
        .replace(/\{\{providerId\}\}/g, providerId)
        .replace(/\{\{title\}\}/g, `LLM Context for ${providerId} API`)
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
    return new Response("Not found", { status: 404 });
  },
};
