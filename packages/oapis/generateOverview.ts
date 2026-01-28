import { OpenapiDocument } from "./types.js";

type OutputType = "overview" | "skills";

const toSkillName = (hostname: string): string =>
  hostname
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

export const generateOverview = (
  hostname: string,
  openapi: OpenapiDocument,
  type: OutputType = "overview",
): string => {
  const output: string[] = [];

  // Helper to get server origin from operation or root servers
  const getServerOrigin = (operation: any, rootServers: any[]): string => {
    const servers = operation?.servers || rootServers || [];
    if (servers.length === 0) return "";
    try {
      const url = new URL(servers[0].url);
      return url.origin;
    } catch (e) {
      return servers[0].url.split("/")[0];
    }
  };

  // Add API general info (only for overview)
  if (type === "overview" && openapi.info) {
    const { title, version, description } = openapi.info;
    const serverOrigin = getServerOrigin(undefined, openapi.servers || []);
    output.push(`${title} v${version} - ${serverOrigin}`);
    if (description) output.push(description);
    output.push("");
  }

  const itemsByTag: Map<
    string,
    {
      operationId: string;
      pathPart: string;
      summaryPart: string;
      openapiUrl: string;
    }[]
  > = new Map();

  const NO_TAG = "__untagged__";

  // Collect tag descriptions from openapi.tags if present
  const tagDescriptions: Map<string, string> = new Map();
  if (openapi.tags) {
    for (const tag of openapi.tags) {
      if (tag.name && tag.description) {
        tagDescriptions.set(tag.name, tag.description);
      }
    }
  }

  // Process each path and operation
  if (openapi.paths) {
    for (const [path, pathItem] of Object.entries(openapi.paths)) {
      const methods = ["get", "post", "put", "patch", "delete"];

      for (const method of methods) {
        const operation = pathItem[method as keyof typeof pathItem];
        if (!operation) continue;

        const serverOrigin = getServerOrigin(operation, openapi.servers || []);
        const operationId = operation.operationId
          ? `${operation.operationId}`
          : "";

        // Build query parameters string
        const queryParams = operation.parameters
          ?.filter((p) => p.in === "query")
          ?.map((p) => `${p.name}=${p.schema?.type || p.name}`)
          ?.join("&");

        const queryString = queryParams ? `?${queryParams}` : "";
        const summaryPart = operation.summary || "";

        const pathPart = `${method.toUpperCase()} ${serverOrigin}${path}${queryString}`;

        const openapiUrl = `https://oapis.org/openapi/${hostname}${
          operationId ? `/` + operationId : path
        }`;

        const item = { operationId, pathPart, summaryPart, openapiUrl };

        // Get tags for this operation, default to NO_TAG if none
        const tags =
          operation.tags && operation.tags.length > 0
            ? operation.tags
            : [NO_TAG];

        for (const tag of tags) {
          if (!itemsByTag.has(tag)) {
            itemsByTag.set(tag, []);
          }
          itemsByTag.get(tag)!.push(item);
        }
      }
    }
  }

  // Calculate total endpoints
  let endpointCount = 0;
  for (const items of itemsByTag.values()) {
    endpointCount += items.length;
  }

  // 10k+ tokens
  const allItems = Array.from(itemsByTag.values()).flat();
  const isLong = JSON.stringify(allItems).length > 10000 * 5;

  // Sort tags alphabetically, but put untagged at the end
  const sortedTags = Array.from(itemsByTag.keys()).sort((a, b) => {
    if (a === NO_TAG) return 1;
    if (b === NO_TAG) return -1;
    return a.localeCompare(b);
  });

  // Output grouped by tag
  for (const tag of sortedTags) {
    const items = itemsByTag.get(tag)!;
    const tagHeader = tag === NO_TAG ? "Other" : tag;
    output.push(`## ${tagHeader}`);
    const tagDescription = tagDescriptions.get(tag);
    if (tagDescription) {
      output.push("");
      output.push(tagDescription);
    }
    output.push("");
    output.push(
      ...items.map(
        (item) =>
          `- [${item.operationId}](${item.openapiUrl}): ${isLong ? "" : `${item.pathPart} - `}${
            item.summaryPart
          }`,
      ),
    );
    output.push("");
  }
  if (type === "skills") {
    const skillName = toSkillName(hostname);
    const title = openapi.info?.title || hostname;
    let description = `${title} API integration.`;
    if (openapi.info?.description) {
      description += ` ${openapi.info.description.slice(0, 900)}`;
    }
    description += ` Use when working with ${hostname}.`;
    description = description.replace(/\n/g, " ").slice(0, 1024);

    output.unshift(
      `---
name: ${skillName}
description: >-
  ${description}
metadata:
  source: oapis.org
  hostname: ${hostname}
  endpoints: "${endpointCount}"
---

# ${title}
`,
    );
  } else {
    output.unshift(
      `# ${hostname} OpenAPI overview

> Below is an overview of the ${hostname} openapi in simple language. This API contains ${endpointCount} endpoints.

For more detailed information of an endpoint, visit https://oapis.org/summary/${hostname}/[idOrRoute]
`,
    );
  }

  return output.join("\n");
};
