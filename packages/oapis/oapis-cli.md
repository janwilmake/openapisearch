It seems a manpage conveys the same information as an `openapi.json` file, even though it is up to 6x more efficient, token wise. Also, APIs are super difficult! There are so many methods, a CURL usually becomes very long, and it's just a waste.

What if we could allow any OpenAPI to be proxied and simplified, such that it can be used as cli.

If you were to make a CLI that would connect to an api, it could probably be done like this:

`npx oapis chatcompletions.com getChatCompletions <llm-base-path> <model-name> <messages> <output-type> <extension> [option]`

See this [example manpage](example.md) which is 6x more token-efficient than the first operation of the [openapi](https://chatcompletions.com/openapi.json).

As an initial CLI we could probably make it so that:

- it looks up the operationId for the domain at /openapi.json
- it fills body, header and query params according to openapi spec, assuming no duplicate naming
- if it gets an unauthorized error, it would collect the API key, store that in a global file
- if there are mistakes in params/options/operationId or you don't provide enough, show the manpage

This tool would scale to all GET APIs and most other apis as long as the required inputs aren't too crazy. It's great because it's much more readable and usable than the entire scope of HTTP, and it simplifies things. This also makes it great for LLMs. The biggest downside is probabl that some POST apis require a large amount of body. However, this can be solved using URLs or (relative) paths for these params. The conversion cannot be done programmatically but definitely using LLMs.
