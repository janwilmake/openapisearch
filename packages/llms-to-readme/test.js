const fs = require("fs");
const { convertLlmsTxtToReadme, processMarkdownLinks } = require("./mod.js");

// Create a test llms.txt file
const testLlmsTxt = `# FastHTML

> FastHTML is a python library which brings together Starlette, Uvicorn, HTMX, and fastcore's \`FT\` "FastTags" into a library for creating server-rendered hypermedia applications.

Important notes:

- Although parts of its API are inspired by FastAPI, it is *not* compatible with FastAPI syntax and is not targeted at creating API services
- FastHTML is compatible with JS-native web components and any vanilla JS library, but not with React, Vue, or Svelte.

## Docs

- [FastHTML quick start](docs/tutorials/quickstart_for_web_devs.html.md): A brief overview of many FastHTML features
- [HTMX reference](https://github.com/bigskysoftware/htmx/blob/master/www/content/reference.md): Brief description of all HTMX attributes, CSS classes, headers, events, extensions, js lib methods, and config options

## Examples

- [Todo list application](examples/adv_app.py): Detailed walk-thru of a complete CRUD app in FastHTML showing idiomatic use of FastHTML and HTMX patterns.

## Optional

- [Starlette full documentation](https://gist.githubusercontent.com/jph00/809e4a4808d4510be0e3dc9565e9cbd3/raw/9b717589ca44cedc8aaf00b2b8cacef922964c0f/starlette-sml.md): A subset of the Starlette documentation useful for FastHTML development.
`;

// Test the processMarkdownLinks function
console.log("Testing processMarkdownLinks function...");
const testResult = processMarkdownLinks(
  testLlmsTxt,
  "testowner",
  "testrepo",
  "main"
);
console.log(testResult);

// Write test file
fs.writeFileSync("test-llms.txt", testLlmsTxt);
console.log(
  "\nTest llms.txt file created. Run: node llms-to-readme.js test-llms.txt test-README.md"
);
