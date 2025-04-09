import { getValidOpenapiUrl } from "./main";

export interface Env {
  LOGO_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Check if the request is for the logo endpoint
    if (!path.startsWith("/logo/")) {
      return new Response("Not found", { status: 404 });
    }

    const finalOpenapiUrl = await getValidOpenapiUrl(request, env as any);

    const openapiUrl = finalOpenapiUrl?.redirectUrl;

    if (!openapiUrl) {
      return new Response("OpenAPI URL is required", { status: 400 });
    }
    const kvKey = "v5/" + openapiUrl;
    console.log({ openapiUrl });
    try {
      // Check if we have a cached logo URL
      const cachedLogo = await env.LOGO_KV.get(kvKey);
      if (cachedLogo) {
        // Return the cached image data
        return fetch(cachedLogo);
      }

      // Fetch the OpenAPI spec
      const openapiResponse = await fetch(openapiUrl);
      if (!openapiResponse.ok) {
        return new Response(
          `Failed to fetch OpenAPI spec: ${openapiResponse.status}`,
          { status: openapiResponse.status },
        );
      }

      const openapiText = await openapiResponse.text();

      // Parse OpenAPI text as either JSON or YAML
      let openapiData: any;
      try {
        // First try to parse as JSON
        openapiData = JSON.parse(openapiText);
      } catch (e) {
        // If JSON parsing fails, try to parse as YAML
        try {
          // Import yaml parser dynamically
          const jsYaml = await import("yaml");
          openapiData = jsYaml.parse(openapiText);
        } catch (yamlError) {
          return new Response("Failed to parse OpenAPI spec as JSON or YAML", {
            status: 400,
          });
        }
      }

      // Extract the first server URL
      if (
        !openapiData.servers ||
        !openapiData.servers[0] ||
        !openapiData.servers[0].url
      ) {
        return new Response("No server URL found in the OpenAPI spec", {
          status: 400,
        });
      }

      const serverUrl = openapiData.servers[0].url;

      // Parse the URL to extract the main domain
      let mainDomain: string;
      try {
        const parsedUrl = new URL(serverUrl);
        const hostParts = parsedUrl.hostname.split(".");
        // Get the main domain (last two parts of the hostname)
        if (hostParts.length >= 2) {
          mainDomain = hostParts.slice(-2).join(".");
        } else {
          mainDomain = parsedUrl.hostname;
        }
      } catch (e) {
        return new Response("Invalid server URL", { status: 400 });
      }

      // Fetch the logo from Google's favicon service
      const logoUrl = `https://www.google.com/s2/favicons?domain=https://${mainDomain}&sz=40`;
      const logoResponse = await fetch(logoUrl);

      if (!logoResponse.ok) {
        return new Response("Failed to fetch logo", { status: 502 });
      }

      // Store the logo in KV for future requests
      await env.LOGO_KV.put(kvKey, logoUrl);

      // Get the logo data
      const logoData = await logoResponse.arrayBuffer();

      // Return the logo
      return new Response(logoData, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch (error) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  },
};
