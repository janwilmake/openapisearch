# Low hanging fruit

- ✅ on the landing, improve clarity that any OpenAPI will work, not just the ones hardcoded.
- ensure to have backend search function with exposed api (fuzzy search would be great)
- expose slop at `/{hostname}` in style of https://github.com/janwilmake/user-agent-router so we can easily switch between OpenAPI and JSON
- if `/{hostname}` not found, perform search and show relevant ones in 404 message (no dead end)
- fix circular deref error: https://x.com/janwilmake/status/1904080564073681085
- allow setting multiple operationIds into the API to return a single OpenAPI for it via elegant GET api (subset of entire api)
- allow people to determine the providerId based on the `openapi.json` location (if explorable, just domain! if not, give tips for improvement)
- figure out if i can add hostname logo to `og-image` (forgithub has it too)

# TODO

Figure out a better way to build a KV store with shorter slugs. Goals:

- Improved shorter URL creation for long openapi urls
- Auto-expand directory with KV store
- Later: Auto-complete
- Auto-expanding sitemap

Draft spec:

- bi-directional KV:
  - `slug:{slug} -> url`
  - `hostname:{string}.{string} -> null`
  - `url:{url} -> key`
- If people fill in a word without tld, add `.com` to look up hostname
- If people fill in a hostname, look up there
- If people fill a URL, load it as openapi, check server URL, check main domain
  - if main domain has `.well-known/openapi` or `/openapi.json|yaml|yml` leading to valid openapi, ensure to add to KV
  - if url was different to main-domain openapi redirect or if there wasn't any, look up `url:{url}` to find slug to redirect to, or create a new one if not already present. should be of format `{hostname}{number}`

Questions:

- Is KV the right storage method or may D1/DOs be better?

# BACKLOG

- Figure out what to do making big files such as https://raw.githubusercontent.com/microsoftgraph/msgraph-metadata/refs/heads/master/openapi/v1.0/openapi.yaml better
