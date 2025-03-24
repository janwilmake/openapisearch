OpenAPI-Search combines multiple OpenAPIs in a fast, organized, and searchable interface.

OpenAPIs are effectively closed if there isn't an accessible way to find and use them. Big commercial API directories such as https://rapidapi.com are currently dominating the search results and the # of APIs indexed, leading many developers to a non-open API gateway. Open Source is far behind.

The best OpenAPI directory as of yet is https://apis.guru but this doesn't even reach 10% of the amount of listed APIs and there is many room for improvement.

The vision of https://openapisearch.com is to make OpenAPIs truly open by making it accessible (easy to find what you're looking for) and improving listing quality.

![](explorer.drawio.png)

Related work: https://github.com/janwilmake/oapis and https://github.com/janwilmake/oapis.npm and https://github.com/janwilmake/openapi-mcp-server

# Goals

Targeted improvements compared to https://apis.guru:

- Easy navigation for agents
- Programmatic Registry
- Improved Website

# Wishlist:

- E2E Testing of OpenAPIs
- AI Crawler for API Discovery
- AI Crawler to augment OpenAPI Metadata
  - Adds authentication + scope info
  - Adds useful links
  - Adds reviews
  - Adds pricing info, ratelimit info, etc

## Non-goals

- Create a docs reference website like [readme.com](https://readme.com) (there are many) - for this we're using stoplight now.
- Add weird custom logic that is non-standard to the OpenAPI. Instead, I aim to create a layer on top of openapis to improve the implementation of the standard. I'll use [actionschema](https://actionschema.com) for this.

# Changelog

- **2025-03-20** - I did lots of work in this area and left it all behind after moving to cloudflare. It's time to take some of this work and redo it with a new vision, taking in all learnings from the last months. My current intuition is as follows; 1) Don't focus on quantity, focus on quality of a few great OpenAPIs. Make it very easy to build with a particular OpenAPI, for example. 2) People want to see their own OpenAPIs, and aren't interested in 99% of all other OpenAPIs.
- **2025-03-23** - https://x.com/janwilmake/status/1903879996592242987

# TODO (low hanging)

Tweet 1: OpenAPI Search Improvements

- allow setting multiple operationIds into the API to return a single OpenAPI for it.
- on the landing, improve clarity that any openapi will work
- allow people to determine the providerID based on the openapi.json location (if explorable, just domain! if not, give tips for improvement)
- figure out if i can add hostname logo to og-image (forgithub has it too)

Tweet 2: Forgithub Badges

- Have an API for forgithub
- Use it to render a form where you can select the ones you like and get a markdown snippet for it with a link to edit the markdown (and easily make PR)
- Have this as API and apply this on some top repos daily, manually, seeing the response.
