import primary from "./providers.json";

export const getMetaviewObject = () => {
  const metaviewObject = Object.entries(primary.providers).reduce(
    (obj, [key, item]) => {
      if (typeof item !== "object" || !("openapiUrl" in item)) {
        return obj;
      }

      return {
        ...obj,
        [key]: {
          description: (item as any)?.info?.description,
          openapiUrl: item.openapiUrl,
        },
      };
    },
    {} as {
      [slug: string]: { description: string | undefined; openapiUrl: string };
    },
  );

  return metaviewObject;
};

export const getOpenapiUrl = async (request: Request) => {
  const chunks = new URL(request.url).pathname.split("/");
  const providerSlug = chunks[2];
  const metaviewObject = getMetaviewObject();
  const openapiUrl = metaviewObject[providerSlug]?.openapiUrl;
  if (!openapiUrl) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(openapiUrl, { status: 200 });
};

export const getMetaview = async (request: Request) => {
  const accept =
    new URL(request.url).searchParams.get("accept") ||
    request.headers.get("accept");

  const metaviewObject = getMetaviewObject();

  if (accept === "text/markdown" || accept?.includes("text/html")) {
    const md = Object.entries(metaviewObject)
      .map(
        ([key, value]) =>
          `- ${key}${value.description ? ` - ${value.description}` : ""}`,
      )
      .join("\n")
      .concat(
        "\n\nGet a more detailed overview of an API by going to https://oapis.org/overview/[id]",
      );
    return new Response(md, { headers: { "content-type": "text/markdown" } });
  }

  return new Response(JSON.stringify(metaviewObject, undefined, 2), {
    headers: { "Content-Type": "application/json" },
  });
};
