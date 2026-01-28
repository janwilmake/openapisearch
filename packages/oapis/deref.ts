import { JSONPointer } from "./jsonPointer";

// from: https://github.com/APIDevTools/json-schema-ref-parser
const example = {
  definitions: {
    person: {
      // references an external file
      $ref: "schemas/people/Bruce-Wayne.json",
    },
    place: {
      // references a sub-schema in an external file
      $ref: "schemas/places.yaml#/definitions/Gotham-City",
    },
    thing: {
      // references a URL
      $ref: "http://wayne-enterprises.com/things/batmobile",
    },
    color: {
      // references a value in an external file via an internal reference
      $ref: "#/definitions/thing/properties/colors/black-as-the-night",
    },
  },
};

/** How to dereference */
export type Dereference =
  | `document:${"current" | "recursive"}${";free" | ""}`
  | "document:none";
/** How to rereference. By specifying the max-size, we can enforce storing documents at a max-size of this amount of MB */
export type Rereference = `max-doc-size:${number};max-storage-size:${number}`;

type Json = string | number | boolean | null | any[] | { [key: string]: any };

export type DerefHeaders = {
  "X-Dereference"?: Dereference;
  "X-Rereference"?: Rereference;
  Authorization?: string;
};
/** 
I need a customised dereferencing capability that:

- works on cloudflare. ensure it handles fetch nicely if done to itself
- works for any JSON with $ref, effectively taking the standard from JSON Schema and applying it on JSON
- has easy configurations to pass authorization and other parameters to ensure I can dereference the way I want.

Add option to dereference by passing a header. When doing that, ensure to merge existing with $ref value gracefully

create deref for all, recursive, but preventing loops.

*/

export const deref = async (
  value: Json,
  baseUrl: string,
  headers?: DerefHeaders,
): Promise<Json> => {
  if (
    value === undefined ||
    value === null ||
    typeof value === "number" ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    // values that can't contain $ref can be immediately returned
    return value;
  }

  if (Array.isArray(value)) {
    // handle arrays
    return await Promise.all(
      value.map((value) => deref(value, baseUrl, headers)),
    );
  }

  // handle all object parameters except ref
  const derefObject = await Object.keys(value)
    .filter((property) => property !== "$ref")
    .reduce(async (promiseAcc, property) => {
      const acc = await promiseAcc;
      const item = value[property];
      return {
        ...acc,
        [property]: await deref(item, baseUrl, headers),
      };
    }, Promise.resolve({} as { [key: string]: any }));

  // the refresult! The special case
  const refResult = await maybeUnref(value, baseUrl, headers);

  const realRefResult = [
    "number",
    "null",
    "boolean",
    "undefined",
    "string",
  ].includes(typeof refResult)
    ? { value: refResult }
    : Array.isArray(refResult)
    ? Object.fromEntries(refResult)
    : (refResult as { [key: string]: any });

  // TODO: Merge them nestedly. I made this before
  return realRefResult ? { ...derefObject, ...realRefResult } : derefObject;
};

const normalizeRef = (ref: string, baseUrl: string) => {
  const [urlPart, hash] = ref.split("#");
  try {
    new URL(urlPart);
    return { urlPart, hash };
  } catch (e) {
    // not an url
    const url = new URL(urlPart, baseUrl);
    return { urlPart: url.toString(), hash };
  }
};

const maybeUnref = async (
  value: { [key: string]: any },
  baseUrl: string,
  headers?: DerefHeaders,
) => {
  if (!value.$ref) {
    return;
  }
  // special property $ref
  const refUrl = normalizeRef(value.$ref, baseUrl);
  const response = await fetch(refUrl.urlPart);
  const json = await response.json();
  const finalJson = refUrl.hash ? JSONPointer.get(json, refUrl.hash) : json;
  return deref(finalJson, refUrl.urlPart, headers);
};
