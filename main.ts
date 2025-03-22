import { parse } from "yaml";
import primary from "./providers.json";
//@ts-ignore
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
 * Main handler function for the Cloudflare Worker
 */
export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
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
    } else if (isRedirect || path.startsWith("/openapi/")) {
      const chunks = new URL(request.url).pathname.split("/");
      const providerSlug = chunks[2];
      const metaviewObject = getMetaviewObject();
      const openapiUrl = metaviewObject[providerSlug]?.openapiUrl;
      if (openapiUrl && isRedirect) {
        return new Response(openapiUrl, {
          status: 307,
          headers: { Location: openapiUrl },
        });
      }

      // If there's no OpenAPI URL in the metaview, it can still exist, just need to check first.
      const hasTld = providerSlug.split(".").length > 1;
      const hasPath = providerSlug.includes("__");
      const finalOpenapiUrl = openapiUrl
        ? openapiUrl
        : hasTld && hasPath
        ? `https://${providerSlug.replaceAll("__", "/")}`
        : hasTld
        ? `https://${providerSlug}/openapi.json`
        : `https://${providerSlug}.com/openapi.json`;

      try {
        const response = await fetch(
          new Request(finalOpenapiUrl, {
            headers: { "content-type": "application/json" },
          }),
        );
        if (!response.ok) {
          return new Response("Not found", { status: 404 });
        }

        const text = await response.text();
        let contentType: string | undefined = undefined;
        //parse as json or yaml
        try {
          JSON.parse(text);
          contentType = "application/json;charset=utf8";
        } catch (e) {
          try {
            parse(text);
            contentType = "text/yaml;charset=utf8";
          } catch (e) {
            return new Response("Not found", { status: 404 });
          }
        }
        // either redirect or go somewhere
        return new Response(isRedirect ? finalOpenapiUrl : text, {
          status: isRedirect ? 307 : 200,
          headers: {
            Location: finalOpenapiUrl,
            "Content-Type": isRedirect ? "text/plain" : contentType,
          },
        });
      } catch (e) {
        return new Response("Not found", { status: 404 });
      }
    } else if (url.pathname.split("/").length === 2) {
      // For the /{providerId} endpoint
      const providerId = url.pathname.slice(1);
      const description = `Easy LLM Context for any API. OpenAPI Search makes APIs Accessible for AI Codegen and tool use!`;
      const title = `LLM Context for ${providerId} API`;
      // HTML template for the landing page
      const landingPageTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>${providerId} API - OpenAPI and SLOP Comparison</title>


  <meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${description}" />
<meta name="robots" content="index, follow" />

<!-- Facebook Meta Tags -->
<meta property="og:url" content="https://openapisearch.com" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="https://og.openapisearch.com/${providerId}" />
<meta property="og:image:alt" content="${description}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>

<!-- Twitter Meta Tags -->
<meta name="twitter:card" content="summary_large_image" />
<meta property="twitter:domain" content="openapisearch.com" />
<meta property="twitter:url" content="https://openapisearch.com" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="https://og.openapisearch.com/${providerId}" />


  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      background-color: #f5f7fa;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    header {
      background: #4f46e5;
      padding: 20px;
      text-align: center;
      color: white;
      border-radius: 12px 12px 0 0;
    }
    header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
    }
    .api-section {
      flex: 1;
      min-width: 300px;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    .openapi-section {
      background-color: #fff9e7;
    }
    .slop-section {
      background-color: #ecfdf5;
    }
    .section-header {
      padding: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .openapi-header {
      color: #b45309;
    }
    .slop-header {
      color: #047857;
    }
    .section-header h2 {
      margin: 0;
      font-size: 18px;
    }
    .token-count {
      background-color: rgba(0, 0, 0, 0.1);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 14px;
    }
    .code-container {
      position: relative;
      background: rgba(0, 0, 0, 0.04);
      border-radius: 0 0 8px 8px;
    }
    .code-area {
      width: 100%;
      height: 400px;
      padding: 15px;
      font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.5;
      border: none;
      background: transparent;
      resize: none;
      box-sizing: border-box;
    }
    .copy-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      background: #4f46e5;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 5px 10px;
      cursor: pointer;
      font-size: 12px;
    }
    .copy-btn:hover {
      background: #3730a3;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Allow LLMs to Navigate the ${providerId} API without Error</h1>
    </header>
    
    <div class="content">
      <div class="api-section openapi-section">
        <div class="section-header openapi-header">
          <h2>OpenAPI</h2>
          <span class="token-count" id="openapi-token-count">Loading...</span>
        </div>
        <div class="code-container">
          <textarea class="code-area" id="openapi-code" readonly>Loading OpenAPI specification...</textarea>
          <button class="copy-btn" id="copy-openapi">Copy</button>
        </div>
      </div>
      
      <div class="api-section slop-section">
        <div class="section-header slop-header">
          <h2>SLOP</h2>
          <span class="token-count" id="slop-token-count">Loading...</span>
        </div>
        <div class="code-container">
          <textarea class="code-area" id="slop-code" readonly>Loading SLOP specification...</textarea>
          <button class="copy-btn" id="copy-slop">Copy</button>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <p>Compare token counts and formats between OpenAPI and SLOP</p>
    </div>
  </div>
  
  <script>
    // Function to calculate tokens
    function calculateTokens(text) {
      return Math.round(text.length / 5);
    }
    
    // Copy to clipboard function
    function copyToClipboard(text) {
      navigator.clipboard.writeText(text).then(() => {
        // Success
      }).catch(err => {
        console.error('Could not copy text: ', err);
      });
    }
    
    // Fetch the specifications
    async function fetchSpecifications() {
      try {
        // Fetch OpenAPI
        const openApiResponse = await fetch('https://openapisearch.com/openapi/${providerId}');
        const openApiText = await openApiResponse.text();
        document.getElementById('openapi-code').value = openApiText;
        
        const openApiTokens = calculateTokens(openApiText);
        document.getElementById('openapi-token-count').textContent = openApiTokens.toLocaleString() + ' tokens';
        
        // Fetch SLOP
        const slopResponse = await fetch('https://oapis.org/slop/${providerId}');
        const slopText = await slopResponse.text();
        document.getElementById('slop-code').value = slopText;
        
        const slopTokens = calculateTokens(slopText);
        document.getElementById('slop-token-count').textContent = slopTokens.toLocaleString() + ' tokens';
        
        // Setup copy buttons
        document.getElementById('copy-openapi').addEventListener('click', () => {
          copyToClipboard(openApiText);
          document.getElementById('copy-openapi').textContent = 'Copied!';
          setTimeout(() => {
            document.getElementById('copy-openapi').textContent = 'Copy';
          }, 2000);
        });
        
        document.getElementById('copy-slop').addEventListener('click', () => {
          copyToClipboard(slopText);
          document.getElementById('copy-slop').textContent = 'Copied!';
          setTimeout(() => {
            document.getElementById('copy-slop').textContent = 'Copy';
          }, 2000);
        });
      } catch (error) {
        console.error('Error fetching specifications:', error);
        document.getElementById('openapi-code').value = 'Error loading OpenAPI specification';
        document.getElementById('slop-code').value = 'Error loading SLOP specification';
      }
    }
    
    // Initialize on page load
    window.addEventListener('DOMContentLoaded', fetchSpecifications);
  </script>
</body>
</html>
`;

      // Return the landing page HTML
      return new Response(landingPageTemplate, {
        headers: { "Content-Type": "text/html;charset=utf8" },
      });
    }

    // Return 404 for any other routes
    return new Response("Not found", { status: 404 });
  },
};
