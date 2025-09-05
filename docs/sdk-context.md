LLMs don't always have the up-to-date context aqbout new versions of APIs. This results in a lot of friction for developers to adopt new libraries. They can easily generate perfect web-standard Javascript code with modern LLMs, but once they start adding dependencies, there's a big chance the LLM starts hallucinating. Developers now resort to providing their LLM with docs with examples, or have the LLM look through the node modules, but this process creates friction and room for error. Other developers resort to web-search which can cause mismatch between the used library version and the sources found online. Besides, it's not token-efficient to include the search process into the context window, but this usually is not removed. A potential solution could come from library maintainers or SDK companies. What could they do to improve the situation?

SDK products like Stainless don't currently have a good solution for a minimum surface file in text format. After a quick look, I found that they generate an `api.md` file, but this is an overview of the different files that contain implementation, not just the surface.

I propose creating `llms.txt` and `llms-full.txt` files not only for websites, but also for libraries and SDKs. The goal is to provide the surface area of the entire SDK without including any implementation details.

Using uithub, I was able to find all files in the published package:
https://uuithub.com/npmjs.com/package/parallel-web?pathPatterns=**%2F*.d.ts

By looking at all files in the package, I was able to extract the relevant files:
https://letmeprompt.com/httpspastebincon-f35tpy0

By looking into these relevant files, I was able to construct how such an `llms.txt` might look like. Similarly, we could create `llms-full.txt` that has the entire surface area of the SDK.

https://letmeprompt.com/rules-httpsuithu-8x7wsu0

Of course, a programmatic way of creating this would be preferable.

Furthermore, this still does not provide a complete understanding of what the SDK does. For this, we also need the documentation. My suggestion would be to include links to the relevant documentation, guides, and blogposts in the source files, such that the OpenAPI will have it as markdown in the API descriptions. The SDKs of all different languages will then automatically also include links to docs, guides, and blogposts.
