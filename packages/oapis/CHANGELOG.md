
# Sunday 12th of January 2025

Created the initial version of this. Please note, previous work is at https://github.com/janwilmake/openapisearch but it had a different idea.

# Thursday, 16th of January, 2025

✅ Look at openapisearch; Find back my hardcoded dataset of openapis and create a KV from that that goes from server to the location. Use this as JSON as a fallback if the server openapi wasn't found - 🔥SIMPLICITY🧡

✅ I need this macroview for all apis in the KV that I like, together with all my own APIs. I need this to be available as a context publicly. An agent using this prompt could then fetch multiple overviews to choose operations and getting their summary: `macroview => overview => summary => build.`

✅ OpenAPI search should work, at least, and oapis can be powered by it. Find ways the data can remain most fresh.

✅ Having this, now I can also make a macro-overview, that has a single line per openapi; or maybe use tag-level overview.

✅ Get function to get all repos (had i not tht in stars.uithub?)

✅ Get all https://openapi.forgithub.com/janwilmake/[repo]/overview and also include repo url.

# Tuesday 28th of January 2026

- Refactored `generateOverview` into its own module (`generateOverview.ts`)
- Enhanced overview output: endpoints are now grouped by tags with tag descriptions
- Added endpoint count to overview header
- Each operation now links to its oapis.org OpenAPI URL
- Added new `/skills/{hostname}` endpoint that generates skill definitions with YAML frontmatter for AI/LLM integrations
- Added `/llms.txt/{hostname}` endpoint (alias for overview format)
- Fixed content-type for overview/slop endpoints from `application/json` to `text/markdown`
- Updated `openapi.json` to include new types: `slop`, `llms.txt`, `skills`
- Added `tags` property to Operation interface in types.ts
- Removed unused `tryParseUrl` function and `slop.ts` file
- Cleaned up README by removing completed TODO section
