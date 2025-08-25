# OpenAPI Docs Reference Strategies

Your source is the source of truth of how your API works, and the OpenAPI is a document that is intended to be the source of truth for the surface area of your API without implementation. Unfortunately, it's often not enough for humans to understand all underlying concepts of the API, so docs are created as a suppelemental material to help humans understand the APIs. A core problem with this is that now you have two sources of truth that aren't properly linked. Now, a human (or AI) needs to go through documentation AND the API references in order to understand any API fully. What's more, is that sometimes, there's blogposts, cookbooks, or guides, with additional undocumented information that can proof helpful for humans to create new applications with an API effectively.

Since all of these things live in different places, and some might not even be controlled by the creator of the platform, it's fair to ask ourselves: how to we provide all the right context for using a particular API into one place? What are different approaches to make it easier for both humans and AIs to get all the useful context, but not too much (we don't want to loose focus or get distracted)?

I've been thinking about this for a while and I've come up with the following strategies for Parallel to create a more coherent and reliable single source of truth:

## 1. Leverage OpenAPI's `externalDocs` parameter

[externalDocs](https://openapispec.com/docs/what/what-is-the-externaldocs-field-in-openapi/) [Allows](https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.1.md#external-documentation-object) referencing an external resource for extended documentation. This seems the most logical approach, however, it's not always practical, because a single operation or tag can have external details in more than one place, and the spec doesn't allow adding more than a single URL.

This may work for humans that understand how to find things from a single starting point, but may not be as easy to do by machines. It also is too limited if we want to include blogs, guides, cookbooks, and other things like that.

## 2. Use Markdown or `@see` in code descriptions

To refer to supplemental documentation for API endpoints, we can use markdown in our OpenAPI operation descriptions with links that refer to documentation, guides, and blogs.

[OpenAPI or JSON Schema](https://letmeprompt.com/rules-httpsuithu-8torc80) both don't explicitly specify supporting `@see`, but OpenAPI does explicitly say they support [CommonMark Markdown](https://commonmark.org). JSON Schema doesn't mention it explicitly, but many JSON Schema tools still support Markdown by convention. Therefore it seems best to go with regular Markdown in the descriptions.

For example, we could add a few links to docs for the Search API like in the footer of the description, like this:

```md
Documentation:

[Quickstart](https://docs.parallel.ai/search-api/search-quickstart)
[Processors](https://docs.parallel.ai/search-api/processors)
```

The disadvantage of this approach is that it's hard to keep this in sync with documentation and all other external materials. This will be a burden to maintain, especially since documentations, cookbooks, and guides are often done by people other than the programmers who write the code.

## 3. Use deep research

What if we created an extension to OpenAPI to augment the descriptions programmatically and keep actively monitoring this weekly? This appraoch could function similarly to how Stainless adds `x-codeSammples` in the build step when generating the OpenAPI from the source code.

If we actively monitor trusted and relevant resources for every operation in the OpenAPI using [our own Task API](https://docs.parallel.ai/api-reference/task-api-v1/create-task-run) on a scheduled basis, and we generate a markdown version of the result

> Question to verify first: Can the task API reason over the citations and confidence it finds for these URLs it refers to to create other properties, or is it a fundamental limitation to the task API that it can't reliably find URLs? In the [best practices](https://docs.parallel.ai/task-api/core-concepts/specify-a-task#task-spec-best-practices) it's mentioned we shouldn't define reasoning or confidence. Can we specify fields to list URLs or is this an antipattern?
