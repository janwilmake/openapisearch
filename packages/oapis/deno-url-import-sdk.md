# A Deno SDK for Any OpenAPI Through URL Imports

Traditional API integration workflows are cumbersome, requiring separate SDKs that bloat your project with hundreds of unnecessary files. I love the deno URL import functionality and decided to make this.

As long as there's a openapi.json available at the domain, you can import a type safe fetch-function as follows:

```typescript
// Save this as test.ts and run it using `deno run --allow-net --allow-import test.ts`

// Import the chat completion function directly
import createChatCompletion from "https://oapis.org/ts/chatcompletions.com/createChatCompletion";

// Use it without any SDK installation
const completion = await createChatCompletion({
  headers: {
    "X-LLM-API-Key": "YOUR_SECRET",
    "X-LLM-Base-Path": "https://api.deepseek.com/v1",
  },
  body: {
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello!" },
    ],
    model: "deepseek-chat",
  },
});

if (completion.body) {
  console.log(completion.body.choices[0].message.content);
  //Hello! How can I assist you today? 😊
} else {
  console.log("ERROR", completion.status);
}
// This works like a charm!
```

Hope you like it. Feedback appreciated!

> NB: Use this at your own risk, works for MOST OpenAPIs, not all. Not thoroughly tested yet. PRs are welcome! One major limitation right now is that it looks at `openapi.json` at the domain provided ONLY. It won't look elsewhere.

## Usage

```
GET https://oapis.org/{type}/{hostname}/{route}
```

Where:

- `type`: What you want to generate (ts, openapi, docs, etc.)
- `hostname`: API hostname (e.g., chatcompletions.com)
- `route`: Specific endpoint or operationId

## Features

- **TypeScript Generation**: Get fully-typed API client code
- **Schema Extraction**: Pull request/response schemas for validation
- **Documentation**: Generate man-page style summaries
- **Format Conversion**: Convert between OpenAPI 3.0 and Swagger
- **ESM/CJS Support**: Get JavaScript in your preferred module format

## Examples

Get a man-page style summary:

```
GET /summary/chatcompletions.com/getChatCompletions
```

Extract response schema:

```
GET /response/chatcompletions/chat/completions
```
