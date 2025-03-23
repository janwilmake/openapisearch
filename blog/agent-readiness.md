# Agent-readiness for API products

Blog coming soon but here's the gist:

1. Make your OpenAPI super good.

Your OpenAPI is your source of truth. Common pitfalls include:

- Missing `operationId`, `summary` and/or `description` in your operations
- Unclear or vague operationId, summary, or description. What matters is clarity to token ratio (a.k.a. signal to noise ratio)
- Missing `servers[0].url` field.
- Not referencing `externalDocs.url`. Almost nobody uses this. If you do, please ensure the url provided responds with markdown by default when accessed via `curl {url}`. When browsers access it, it's fine to respond with html.

2. Make your OpenAPI explorable.

Unfortunately there has not been any conclusion on how OAS wants to be made explorable still, but discussions have been plentiful. The easiest way to do make it explorable, is redirecting to your `openapi.json` file from https://yourlanding.com/.well-known/openapi. Besides that, it's good practice to put your `openapi.json` at the root of your api tld.

More coming. I'm working with several API builders to make the https://github.com/janwilmake/openapi-mcp-server work perfectly. For this, we mainly need better OpenAPI specs.
