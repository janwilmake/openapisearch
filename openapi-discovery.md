# Making Your OpenAPI Specification Discoverable

In today's API-driven world, making your OpenAPI specification easily discoverable shouldn't be complicated. At OpenAPISearch, we've built a system that intelligently finds and serves OpenAPI specs across the web. But there are really just two key practices you need to follow:

## The Only Two Things You Need to Do

### 1. Use Standard Root Paths

Host your OpenAPI specification at one of these standard locations:

```
/openapi.json
/openapi.yaml
```

This is the most direct approach - put your specification right at the root of your domain where it's easy to find.

### 2. Set Up Well-Known Redirects

If you can't place your spec at the root, set up a redirect from:

```
/.well-known/openapi
```

These paths follow the [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615) standard for well-known URIs and make your API discoverable in a standardized way.

## Why This Matters

Our [discovery service](https://github.com/janwilmake/openapisearch/blob/main/findCachedOpenapiUrl.ts) checks these locations first before trying dozens of other possible paths. When you follow these simple conventions:

- AI tools can automatically find and use your API
- Developers spend less time hunting for documentation
- Your API becomes part of the discoverable ecosystem

While our service checks [many other locations](https://github.com/janwilmake/openapisearch/blob/main/findCachedOpenapiUrl.ts#L19-L70), focusing on these two standards will make your API immediately discoverable to the widest range of tools and services.

Want to see if your API is already discoverable? Visit [openapisearch.com](https://openapisearch.com) and enter your API's hostname.

Questions or suggestions? Reach out to me at [@janwilmake](https://x.com/janwilmake) on Twitter!
