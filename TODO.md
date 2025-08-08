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
