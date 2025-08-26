# A call for library maintainers to create better context.

SDKs suck in the age of AI coding.

With AI tooling like cursor and claude code we're all blindly trusting the "AI context engine" that it will just magically find what it needs to know and nothing else, and never hallucinate.

But is it really that great? Tools like @context7AI seem to improve it, but is Vector Search the only way?

Tbh, it never works for me!

Docs aren't complete. SDK context is too large. The complete spec can often be found in the API reference which is based off OpenAPI.

With OpenAPISearch I created a way to allow very easy navigation through large OpenAPIs with tons of information. @mintlify adopted the same approach, linking to subsets of the openapi spec (each operation) from their generated `llms.txt`. Now I'm looking for the same thing for SDKs. @StainlessAPI has some great reads on MCP https://www.stainless.com/blog/mcp-is-eating-the-world-and-its-here-to-stay, https://www.stainless.com/blog/from-api-to-mcp-a-practical-guide-for-developers, but their SDK builds don't create neat API surface files. Are these MCPs gonna be able to use the SDK, or just the APIs?

Seems people are skipping a step.

Parallel uses Stainless and soon we'll have a Typescript SDK. The token count of the source of the Typescript SDK is around 180k tokens. After merging types into one file for the Parallel SDK using https://api-extractor.com, I got it down to 18k tokens. But this is still a lot! The original source OpenAPI was under 12000 tokens. A simple prompt shows it can easily be reduced to just 4500 tokens https://letmeprompt.com/rules-httpsuithu-s10son0. This is starting to be more manageable for AI.

What if SDK companies like @StainlessAPI, @buildwithfern, and @scalar would generate "agent friendly" API surface files?

- .d.ts for typescript
- .pyi for python
- etc etc etc

But not only for the entire SDK but also for every individual method, like openapisearch.com does for API operations?

I think this would make selecting the right context much easier and give the developer more freedom to choose different strategies to build high-quality context.

Library and API maintainers, SDK creators, please! Fix your context and put it in your repos!
