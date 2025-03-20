import primary from "./providers.json";
import homepage from "./homepage.html";
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
  if (accept === "text/markdown" || accept?.includes("text/html")) {
    const md = Object.entries(metaviewObject)
      .map(
        ([key, value]) =>
          `- ${key}${value.description ? ` - ${value.description}` : ""}`,
      )
      .join("\n");

    return new Response(md, { headers: { "content-type": "text/markdown" } });
  }
  return new Response(JSON.stringify(metaviewObject, undefined, 2), {
    headers: { "Content-Type": "application/json" },
  });
};

/**
 * Main handler function for the Cloudflare Worker
 */
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const accept = request.headers.get("accept");
    // Route requests based on the path
    if (path === "/" || path.startsWith("/index.")) {
      if (accept?.includes("text/html") && path !== "/index.md") {
        return new Response(homepage, {
          headers: { "content-type": "text/html;charset=utf8" },
        });
      }
      return await getMetaview(request);
    } else if (path.startsWith("/redirect/")) {
      const chunks = new URL(request.url).pathname.split("/");
      const providerSlug = chunks[2];
      const metaviewObject = getMetaviewObject();
      const openapiUrl = metaviewObject[providerSlug]?.openapiUrl;
      if (!openapiUrl) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(openapiUrl, {
        status: 307,
        headers: { Location: openapiUrl },
      });
    }

    // Return 404 for any other routes
    return new Response("Not found", { status: 404 });
  },
};
