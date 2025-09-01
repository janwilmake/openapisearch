1. Make your OpenAPI super good.

Your OpenAPI is your source of truth. Common pitfalls include:

- Missing `operationId`, `summary` and/or `description` in your operations (summary should be up to 1 sentence, description up to a paragraph)
- Unclear or vague `operationId`, `summary`, or `description`. What matters is clarity to token ratio (a.k.a. signal to noise ratio)
- Missing `servers[0].url` field.
- Missing authentication options.
- Not referencing `externalDocs.url`. Almost nobody uses this. If you do, please ensure the url provided responds with markdown by default when accessed via `curl {url}`. When browsers access it, it's fine to respond with html.

A good OpenAPI specification should allow an agent to navigate the entirety of your APIs and should be easily navigatable. To make the API more navigatable, I have developed [openapi-for-llms](https://github.com/janwilmake/openapisearch/tree/main/packages/openapi-for-llms) which collapses your OpenAPI spec into a [llms.txt](https://llmstxt.org) compatible file that can be exposed on the web or in your repo. To make this file high-quality, it's important to provide a high-level overview to the APIs on how to use them. This can either be placed in `info.description` or as part of your `tags[n].description` fields. Tags will be leveraged to structure your llms.txt better, grouping the APIs per tag.

2. Make your OpenAPI discoverable.

Unfortunately there has not been any conclusion on how OAS wants to be made discoverable still, but discussions have been plentiful. The easiest way to do make it discoverable, is redirecting to your `openapi.json` file from https://yourlanding.com/.well-known/openapi. Besides that, it's good practice to put your `openapi.json` at the root of your api tld. Read more in [openapi-discovery](openapi-discovery.md)

3. Have all your APIs documented in a single OpenAPI file

Some large APIs have different files for different parts of their API. In that case, it's best to merge it in some way, for example with [redocly](https://redocly.com/blog/combining-openapis)
