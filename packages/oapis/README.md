# OAPIS - Useful OpenAPI Transformations

OAPIS is an API that finds and formats openapis or operations.

Types available:

> For one or multiple APIs:

- "summary": a man-page style summary of the openapi or the specified route/id
- "openapi": the openapi with all routes or the specified route/id
- "overview": overview of an openapi that includes just general info and a few lines per operation
- "operations": operations in the openapi in a simpler format

> For a single API:

- "request": the JSON schema for only the request
- "response": the JSON schema for only the response
- "ts": a typescript function to fetch this api
- "esm": a ecmascript module to fetch this api
- "cjs": a common js function to fetch this api
