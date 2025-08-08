#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { load, dump } from "js-yaml";
import { resolve } from "path";
import { dereferenceSync } from "./deref.js";

/**
 * Slugify a string to only contain a-zA-Z0-9
 */
function slugify(str) {
  if (!str) return "";
  return str
    .toString()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Fetch external documentation
 */
async function fetchExternalDocs(url) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/markdown, text/plain, */*",
      },
    });

    if (!response.ok) {
      console.warn(
        `Failed to fetch external docs from ${url}: ${response.status}`
      );
      return null;
    }

    return await response.text();
  } catch (error) {
    console.warn(`Error fetching external docs from ${url}:`, error.message);
    return null;
  }
}

/**
 * Find referenced schemas in a JSON object
 */
function findRefs(json, refs, refPrefix = "#/components/schemas/") {
  if (!refs) return [];

  const string = JSON.stringify(json, undefined, 0);
  const refsIncluded = Object.keys(refs).filter((refKey) => {
    const snippet = `"$ref":"${refPrefix}${refKey}"`;
    return string.includes(snippet);
  });
  return refsIncluded;
}

/**
 * Create a subset of OpenAPI document with only the needed components
 */
function createSubset(openapi, paths, operationFilter = null) {
  const subset = {
    openapi: openapi.openapi,
    info: openapi.info,
    servers: openapi.servers,
    paths: {},
  };

  // Add filtered paths
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;

    const filteredPathItem = {};
    const methods = [
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "head",
      "options",
      "trace",
    ];

    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      if (operationFilter && !operationFilter(operation, method, path))
        continue;

      filteredPathItem[method] = operation;
    }

    if (Object.keys(filteredPathItem).length > 0) {
      subset.paths[path] = filteredPathItem;
    }
  }

  // Find and include only referenced components
  const neededRefs = findRefs(subset, openapi.components?.schemas);

  if (neededRefs.length > 0 && openapi.components?.schemas) {
    subset.components = { schemas: {} };
    for (const refName of neededRefs) {
      if (openapi.components.schemas[refName]) {
        subset.components.schemas[refName] =
          openapi.components.schemas[refName];
      }
    }
  }

  // Include other components if they exist and are referenced
  if (openapi.components) {
    const componentTypes = [
      "parameters",
      "responses",
      "examples",
      "requestBodies",
      "headers",
      "securitySchemes",
      "links",
      "callbacks",
    ];

    for (const componentType of componentTypes) {
      if (openapi.components[componentType]) {
        const componentRefs = findRefs(
          subset,
          openapi.components[componentType],
          `#/components/${componentType}/`
        );
        if (componentRefs.length > 0) {
          if (!subset.components) subset.components = {};
          subset.components[componentType] = {};
          for (const refName of componentRefs) {
            subset.components[componentType][refName] =
              openapi.components[componentType][refName];
          }
        }
      }
    }
  }

  return subset;
}

/**
 * Generate llms.txt content according to spec
 */
function generateLlmsTxt(openapi, openapiFile) {
  const operations = [];
  const tagOperations = new Map();
  const tagInfo = new Map();

  // Collect tag information from the OpenAPI document
  if (openapi.tags) {
    for (const tag of openapi.tags) {
      tagInfo.set(tag.name, tag);
      tagOperations.set(tag.name, []);
    }
  }

  // Collect untagged operations
  const untaggedOperations = [];

  // Collect all operations and organize by tags
  for (const [path, pathItem] of Object.entries(openapi.paths || {})) {
    if (!pathItem || typeof pathItem !== "object") continue;

    const methods = [
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "head",
      "options",
      "trace",
    ];

    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      const originalOperationId =
        operation.operationId ||
        `${path.slice(1).replace(/[^a-zA-Z0-9]/g, "_")}_${method}`;
      const slugifiedOperationId = slugify(originalOperationId);

      const operationData = {
        operationId: originalOperationId,
        slugifiedOperationId,
        method: method.toUpperCase(),
        path,
        summary: operation.summary || `${method.toUpperCase()} ${path}`,
        description: operation.description,
        tags: operation.tags || [],
      };

      operations.push(operationData);

      // Organize by tags
      if (operation.tags && operation.tags.length > 0) {
        for (const tag of operation.tags) {
          if (!tagOperations.has(tag)) {
            tagOperations.set(tag, []);
          }
          tagOperations.get(tag).push(operationData);
        }
      } else {
        untaggedOperations.push(operationData);
      }
    }
  }

  // Generate llms.txt content according to spec
  let content = `# ${openapi.info?.title || "API"}\n\n`;

  // Required blockquote with summary
  let summary = "";
  if (openapi.info?.description) {
    // Take first paragraph or sentence as summary
    summary = openapi.info.description.split("\n")[0].split(".")[0] + ".";
  } else {
    summary = `API documentation for ${openapi.info?.title || "this service"}.`;
  }
  content += `> ${summary}\n\n`;

  // Optional details section
  let details = [];

  if (openapi.info?.version) {
    details.push(`**Version:** ${openapi.info.version}`);
  }

  if (openapi.servers && openapi.servers.length > 0) {
    details.push(`**Base URL:** ${openapi.servers[0].url}`);
  }

  if (
    openapi.info?.contact?.name ||
    openapi.info?.contact?.email ||
    openapi.info?.contact?.url
  ) {
    let contactInfo = "**Contact:**";
    if (openapi.info.contact.name)
      contactInfo += ` ${openapi.info.contact.name}`;
    if (openapi.info.contact.email)
      contactInfo += ` <${openapi.info.contact.email}>`;
    if (openapi.info.contact.url)
      contactInfo += ` (${openapi.info.contact.url})`;
    details.push(contactInfo);
  }

  if (openapi.info?.license?.name) {
    let licenseInfo = `**License:** ${openapi.info.license.name}`;
    if (openapi.info.license.url)
      licenseInfo += ` (${openapi.info.license.url})`;
    details.push(licenseInfo);
  }

  if (
    openapi.info?.description &&
    openapi.info.description.length > summary.length
  ) {
    // Add full description if it's longer than the summary
    const fullDescription = openapi.info.description
      .replace(summary, "")
      .trim();
    if (fullDescription) {
      details.push(fullDescription);
    }
  }

  if (details.length > 0) {
    content += details.join("\n\n") + "\n\n";
  }

  content += `[Full OpenAPI Spec](${openapiFile})\n\n`;

  // Add sections for each tag (H2 headers)
  const sortedTags = Array.from(tagOperations.keys()).sort();

  for (const tag of sortedTags) {
    const ops = tagOperations.get(tag);
    if (ops.length === 0) continue;

    const tagData = tagInfo.get(tag);
    const sectionName = tagData?.name || tag;
    const slugifiedTag = slugify(tag);

    content += `## ${sectionName}\n\n`;

    // Add tag description if available
    if (tagData?.description) {
      content += `${tagData.description}\n\n`;
    }

    content += `- [${sectionName} operations](tags/${slugifiedTag}.yaml) All '${sectionName}' operations in one file\n`;

    // List operations for this tag
    for (const op of ops) {
      const linkText = `${op.method} ${op.path}`;
      const linkUrl = `operations/${op.slugifiedOperationId}.yaml`;
      let linkLine = `- [${linkText}](${linkUrl})`;

      if (op.summary && op.summary !== `${op.method} ${op.path}`) {
        linkLine += `: ${op.summary}`;
      } else if (op.description) {
        // Use first sentence of description if no summary
        const firstSentence = op.description.split(".")[0] + ".";
        linkLine += `: ${firstSentence}`;
      }

      content += linkLine + "\n";
    }
    content += "\n";
  }

  // Add untagged operations if any exist
  if (untaggedOperations.length > 0) {
    content += `## General\n\n`;
    content += `- [General operations](tags/untagged.yaml) All untagged operations in one file\n`;

    for (const op of untaggedOperations) {
      const linkText = `${op.method} ${op.path}`;
      const linkUrl = `operations/${op.slugifiedOperationId}.yaml`;
      let linkLine = `- [${linkText}](${linkUrl})`;

      if (op.summary && op.summary !== `${op.method} ${op.path}`) {
        linkLine += `: ${op.summary}`;
      } else if (op.description) {
        const firstSentence = op.description.split(".")[0] + ".";
        linkLine += `: ${firstSentence}`;
      }

      content += linkLine + "\n";
    }
    content += "\n";
  }

  return content;
}

/**
 * Process OpenAPI document and generate all files
 */
async function processOpenAPI(openapi, openapiFile) {
  const files = {};

  try {
    // Dereference the OpenAPI document for processing
    const dereferenced = dereferenceSync(openapi);

    // Generate main llms.txt
    files["llms.txt"] = { content: generateLlmsTxt(dereferenced, openapiFile) };

    // Collect operations and tags
    const operations = [];
    const tags = new Set();
    const tagInfo = new Map();

    // Collect tag information from the OpenAPI document
    if (openapi.tags) {
      for (const tag of openapi.tags) {
        tagInfo.set(tag.name, tag);
      }
    }

    for (const [path, pathItem] of Object.entries(dereferenced.paths || {})) {
      if (!pathItem || typeof pathItem !== "object") continue;

      const methods = [
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "head",
        "options",
        "trace",
      ];

      for (const method of methods) {
        const operation = pathItem[method];
        if (!operation) continue;

        const originalOperationId =
          operation.operationId ||
          `${path.slice(1).replace(/[^a-zA-Z0-9]/g, "_")}_${method}`;
        const slugifiedOperationId = slugify(originalOperationId);
        const operationTags = operation.tags || [];

        operations.push({
          operationId: originalOperationId,
          slugifiedOperationId,
          path,
          method,
          operation,
          tags: operationTags,
        });

        operationTags.forEach((tag) => tags.add(tag));

        // Fetch external docs for operation if present
        if (operation.externalDocs?.url) {
          const docs = await fetchExternalDocs(operation.externalDocs.url);
          if (docs) {
            files[`operations/${slugifiedOperationId}-docs.md`] = {
              content: docs,
            };
          }
        }
      }
    }

    // Generate operation files
    for (const {
      slugifiedOperationId,
      path,
      method,
      operation,
    } of operations) {
      const operationSubset = createSubset(
        openapi, // Use original openapi to preserve refs
        { [path]: { [method]: operation } }
      );

      files[`operations/${slugifiedOperationId}.yaml`] = {
        content: dump(operationSubset, { noRefs: true, indent: 2 }),
      };
    }

    // Generate tag files and fetch external docs
    for (const tag of tags) {
      const slugifiedTag = slugify(tag);
      const tagPaths = {};

      for (const [path, pathItem] of Object.entries(openapi.paths || {})) {
        if (!pathItem || typeof pathItem !== "object") continue;

        const methods = [
          "get",
          "post",
          "put",
          "patch",
          "delete",
          "head",
          "options",
          "trace",
        ];
        const filteredPathItem = {};

        for (const method of methods) {
          const operation = pathItem[method];
          if (!operation) continue;

          if (operation.tags?.includes(tag)) {
            filteredPathItem[method] = operation;
          }
        }

        if (Object.keys(filteredPathItem).length > 0) {
          tagPaths[path] = filteredPathItem;
        }
      }

      if (Object.keys(tagPaths).length > 0) {
        const tagSubset = createSubset(openapi, tagPaths);
        files[`tags/${slugifiedTag}.yaml`] = {
          content: dump(tagSubset, { noRefs: true, indent: 2 }),
        };

        // Fetch external docs for tag if present
        const tagData = tagInfo.get(tag);
        if (tagData?.externalDocs?.url) {
          const docs = await fetchExternalDocs(tagData.externalDocs.url);
          if (docs) {
            files[`tags/${slugifiedTag}-docs.md`] = { content: docs };
          }
        }
      }
    }

    // Handle untagged operations
    const untaggedPaths = {};
    for (const [path, pathItem] of Object.entries(openapi.paths || {})) {
      if (!pathItem || typeof pathItem !== "object") continue;

      const methods = [
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "head",
        "options",
        "trace",
      ];
      const filteredPathItem = {};

      for (const method of methods) {
        const operation = pathItem[method];
        if (!operation) continue;

        if (!operation.tags || operation.tags.length === 0) {
          filteredPathItem[method] = operation;
        }
      }

      if (Object.keys(filteredPathItem).length > 0) {
        untaggedPaths[path] = filteredPathItem;
      }
    }

    if (Object.keys(untaggedPaths).length > 0) {
      const untaggedSubset = createSubset(openapi, untaggedPaths);
      files["tags/untagged.yaml"] = {
        content: dump(untaggedSubset, { noRefs: true, indent: 2 }),
      };
    }
  } catch (error) {
    console.error("Error processing OpenAPI:", error.message);
    process.exit(1);
  }

  return files;
}

/**
 * CLI functionality
 */
async function runCLI() {
  const cwd = process.cwd();

  // Look for OpenAPI file
  let openapiFile = null;
  let openapiContent = null;

  if (existsSync(resolve(cwd, "openapi.json"))) {
    openapiFile = "openapi.json";
    openapiContent = JSON.parse(
      readFileSync(resolve(cwd, openapiFile), "utf8")
    );
  } else if (existsSync(resolve(cwd, "openapi.yaml"))) {
    openapiFile = "openapi.yaml";
    openapiContent = load(readFileSync(resolve(cwd, openapiFile), "utf8"));
  } else if (existsSync(resolve(cwd, "openapi.yml"))) {
    openapiFile = "openapi.yml";
    openapiContent = load(readFileSync(resolve(cwd, openapiFile), "utf8"));
  } else {
    console.error(
      "No openapi.json, openapi.yaml, or openapi.yml found in current directory"
    );
    process.exit(1);
  }

  console.log(`Found ${openapiFile}, processing...`);

  // Process the OpenAPI document
  const files = await processOpenAPI(openapiContent, openapiFile);

  // Write all files
  for (const [filePath, fileData] of Object.entries(files)) {
    const fullPath = resolve(cwd, filePath);
    const dir = resolve(fullPath, "..");

    // Create directory if it doesn't exist
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, fileData.content, "utf8");
    console.log(`Created: ${filePath}`);
  }

  console.log(
    `\nGenerated ${Object.keys(files).length} files from ${openapiFile}`
  );
  console.log("Main overview available in llms.txt");
}

// Export the function for programmatic use
export { processOpenAPI };

// Run CLI if this file is executed directly
if (!!process.argv[1]) {
  console.log("running cli");
  runCLI();
}
