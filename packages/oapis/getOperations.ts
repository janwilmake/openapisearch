import type { JSONSchema7 } from "json-schema";
import type { OpenAPIV3 } from "openapi-types";

type NonFunctionKeyNames<T> = Exclude<
  {
    [key in keyof T]: T[key] extends Function ? never : key;
  }[keyof T],
  undefined
>;

type RemoveFunctions<T> = Pick<T, NonFunctionKeyNames<T>>;

export type OpenapiDocument = RemoveFunctions<OpenAPIV3.Document>;

export type OpenapiPathsObject = OpenAPIV3.PathsObject;
export type OpenapiSchemasObject = OpenAPIV3.ComponentsObject["schemas"];
export type OpenapiHeaderObject = OpenAPIV3.HeaderObject;
export type OpenapiServerObject = OpenAPIV3.ServerObject;
export type OpenapiSecuritySchemeObject = OpenAPIV3.SecuritySchemeObject;
export type OpenapiApiSecurityScheme = OpenAPIV3.ApiKeySecurityScheme;

export type OpenapiPathItemObject = OpenAPIV3.PathItemObject;
export type OpenapiMediaType = OpenAPIV3.MediaTypeObject;
export type OpenapiArraySchemaObject = OpenAPIV3.ArraySchemaObject;
export type OpenapiParameterObject = OpenAPIV3.ParameterObject;
export type OpenapiSchemaObject = OpenAPIV3.SchemaObject;
export type OpenapiReferenceObject = OpenAPIV3.ReferenceObject;
export type OpenapiRequestBodyObject = OpenAPIV3.RequestBodyObject;
export type OpenapiOperationObject = OpenAPIV3.OperationObject;
export type OpenapiResponseObject = OpenAPIV3.ResponseObject;
export type HttpMethods = OpenAPIV3.HttpMethods;
export type ReferenceObject = OpenAPIV3.ReferenceObject;
export type HttpMethodEnum =
  | "get"
  | "put"
  | "post"
  | "delete"
  | "options"
  | "head"
  | "patch"
  | "trace";

/** Renames all refs to #/components/schemas/ instead of #/definitions */
const renameRefs = <T extends JSONSchema7 | undefined>(
  schema: T,
  toType: "openapi" | "jsonschema" = "openapi",
): T => {
  if (!schema) {
    return schema;
  }
  // NO SPACES
  const string = JSON.stringify(schema, undefined, 0);

  const jsonschemaLocation = `"$ref":"#/definitions/`;
  const openapiLocation = `"$ref":"#/components/schemas/`;

  const from = toType === "jsonschema" ? openapiLocation : jsonschemaLocation;
  const to = toType === "jsonschema" ? jsonschemaLocation : openapiLocation;

  const newString = string.replaceAll(from, to);

  return JSON.parse(newString) as T;
};
export const omitUndefinedValues = <T extends { [key: string]: any }>(
  object: T,
) => {
  Object.keys(object).map((key) => {
    const value = object[key];
    if (value === undefined) {
      delete object[key];
    }
  });

  return object;
};

type O = { [key: string]: any };

/**
 * Removes empty values (null or undefined) from your arrays in a type-safe way
 */
function notEmpty<TValue extends unknown>(
  value: TValue | null | undefined,
): value is TValue {
  return value !== null && value !== undefined;
}

const mergeObjectsArray = <T extends { [key: string]: any }>(
  objectsArray: T[],
): T => {
  const result = objectsArray.reduce((previous, current) => {
    return { ...previous, ...current };
  }, {} as T);

  return result;
};

type ParsedOperation = {
  openapiUrl: string;
  /** OperationID but with extra that if it's missing, it'll use 'path=method' to create this unique identifier. */
  operationId: string;

  openapiId: string | undefined;
  path: string;
  /** Taken from operation, path item, and lastly the root of the openapi (this is the openapi v3 spec)
   */
  serversWithOrigin: OpenapiServerObject[];
  method: HttpMethodEnum;

  operation: OpenapiOperationObject;
  parameters?: OpenapiParameterObject[];
  resolvedRequestBodySchema?: JSONSchema7;
  responseStatusSchemas: {
    status: string;
    description: string;
    mergedSchema: JSONSchema7;
  }[];

  mergedInputSchema?: JSONSchema7;

  /**
   FORMAT:

  {
    status: number;
    statusDescription?: string;
    statusText?: string;
    [mediaType]: any non-object
    ...any object
  }

   */
  mergedOutputSchema?: JSONSchema7;

  definitions?: {
    [key: string]: JSONSchema7;
  };
};

/** Resolves local ref synchronously */
const resolveLocalRef = <T>(
  openapi: OpenapiDocument,
  schemaOrRef: T | OpenapiReferenceObject,
) => {
  const ref = (schemaOrRef as any)?.$ref;
  if (ref && ref.startsWith("#")) {
    const chunks: string[] = ref.split("/").slice(1);
    const referencedSchema = chunks.reduce(
      (previous, chunk) => previous?.[chunk],
      openapi as { [key: string]: any },
    ) as T | undefined;
    return referencedSchema;
  }
  return schemaOrRef as Exclude<T, OpenapiReferenceObject>;
};

/**
 * Responds with the operations from an openapi document by looking in the paths and (next)-allowed methods.
 *
 * Besides this, it aims to create a more flat object for each input and output.
 */
export const getOperations = (
  openapi: OpenapiDocument,
  openapiId: string,
  openapiUrl: string,
  operationIds?: string[],
) => {
  if (
    !openapiId ||
    !openapiUrl ||
    !openapi ||
    !openapi.paths ||
    typeof openapi.paths !== "object"
  ) {
    return;
  }

  const allowedMethods = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "head",
    "options",
  ];

  const operations: ParsedOperation[] = Object.keys(openapi.paths)
    .map((path) => {
      const item: OpenapiPathItemObject | undefined =
        openapi.paths![path as keyof typeof openapi.paths];

      if (!item || typeof item !== "object") {
        return;
      }

      const methods = Object.keys(item).filter((method) =>
        allowedMethods.includes(method),
      );

      const pathMethods = methods
        .map((method) => {
          const operation = item[
            method as keyof typeof item
          ] as OpenapiOperationObject;

          const operationId =
            operation.operationId || path.slice(1) + "__" + method;

          if (operationIds && !operationIds.includes(operationId)) {
            // prune early
            return;
          }

          const servers = operation.servers?.length
            ? operation.servers
            : item.servers?.length
            ? item.servers
            : openapi.servers;

          const serversWithUrl = servers?.filter((x) => !!x.url);
          const serversWithBaseServer =
            serversWithUrl && serversWithUrl.length > 0
              ? serversWithUrl
              : openapiUrl
              ? [{ url: openapiUrl }]
              : [];

          const serversWithOrigin = serversWithBaseServer.map((server) => {
            const fullUrl =
              server.url.startsWith("http://") ||
              server.url.startsWith("https://")
                ? server.url
                : new URL(openapiUrl).origin + server.url;

            return { ...server, url: fullUrl } as OpenapiServerObject;
          });

          const parameters = (operation.parameters || item.parameters)
            ?.map((item) => resolveLocalRef(openapi, item))
            .filter(notEmpty);

          const parameterSchemas = (parameters || []).map(
            (item) =>
              ({
                type: "object",
                required: item.required ? [item.name] : undefined,
                properties: {
                  [item.name]: resolveLocalRef(openapi, item.schema),
                },
              } as JSONSchema7 | undefined),
          );

          const statusCodes =
            operation.responses && typeof operation.responses === "object"
              ? Object.keys(operation.responses)
              : [];

          const responseStatusSchemas = statusCodes.map((status) => {
            const responseObject = resolveLocalRef(
              openapi,
              operation.responses[status],
            )!;

            const mediaTypeKeys = responseObject.content
              ? Object.keys(responseObject.content)
              : [];

            const mediaTypes = mediaTypeKeys
              .map((mediaType) => {
                const mediaTypeObject = responseObject.content?.[mediaType];
                if (!mediaTypeObject) {
                  return;
                }
                return { ...mediaTypeObject, mediaType };
              })
              .filter(notEmpty);

            const headerNames = responseObject.headers
              ? Object.keys(responseObject.headers)
              : [];

            const headers = headerNames
              .map((name) => {
                const headerObject = resolveLocalRef(
                  openapi,
                  responseObject.headers?.[name],
                );
                if (!headerObject) {
                  return;
                }

                return { ...headerObject, name };
              })
              .filter(notEmpty);

            // each statuscode can have multiple mediatypes and multiple headers. can we make it flatter here?
            // most common mediatypes are text/plain and json & co.
            // we can probably create a schema in which we merge all object schema mediatypes, and add a mediatype key

            const headersSchema: JSONSchema7 = {
              type: "object",
              properties: mergeObjectsArray(
                headers
                  .map((item) => {
                    const schema = resolveLocalRef(openapi, item.schema);
                    if (!schema) {
                      return;
                    }

                    return {
                      [item.name]: schema as JSONSchema7,
                    };
                  })
                  .filter(notEmpty),
              ),
            };

            const mediaTypesSchemas = mediaTypes.map((item) => {
              const schema = resolveLocalRef(openapi, item.schema) as
                | JSONSchema7
                | undefined;
              const schemaType = schema?.type === "object";

              //  console.log({ schema: item.schema, resolved: schema });

              return schemaType
                ? schema
                : ({
                    type: "object",
                    properties: {
                      [item.mediaType]: schema,
                    },
                  } as JSONSchema7);
            });

            const mediaTypeDescriptions = mediaTypes
              .map(
                (item) =>
                  `${item.mediaType}: ${
                    resolveLocalRef(openapi, item.schema)?.description ||
                    "No description"
                  }`,
              )
              .join("\n\n");

            const allSchemas = [headersSchema].concat(mediaTypesSchemas);

            const mergedSchema = allSchemas.reduce(
              (accumulator, next) => {
                // NB: This assumes body and parameters have no overlapping naming!
                return {
                  ...accumulator,
                  properties: {
                    ...accumulator.properties,
                    ...next.properties,
                  },
                  required: (accumulator.required || []).concat(
                    next.required || [],
                  ),
                };
              },
              {
                type: "object",
                properties: {},
                required: [],
                description: mediaTypeDescriptions,
              } as JSONSchema7,
            );

            return {
              status,
              description: responseObject.description,
              mergedSchema,
            };
          });
          const bestStatusCode =
            statusCodes.find((x) => x === "200") ||
            statusCodes.find((x) => x.startsWith("2")) ||
            statusCodes[0];

          const bestStatusResponse = responseStatusSchemas.find(
            (x) => x.status === bestStatusCode,
          );

          const resolvedRequestBodySchema =
            // NB: only application/json is supported now!
            resolveLocalRef(
              openapi,
              (operation.requestBody as OpenapiRequestBodyObject)?.content?.[
                "application/json"
              ]?.schema,
            ) as JSONSchema7 | undefined;

          const allSchemas = [resolvedRequestBodySchema]
            .concat(parameterSchemas)
            .filter(notEmpty);

          const mergedInputSchema = allSchemas.reduce(
            (accumulator, next) => {
              // NB: This assumes body and parameters have no overlapping naming!
              return {
                ...accumulator,
                properties: {
                  ...accumulator.properties,
                  ...next.properties,
                },
                required: (accumulator.required || []).concat(
                  next.required || [],
                ),
              };
            },
            {
              type: "object",
              properties: {},
              required: [],
              additionalProperties: false,
              description:
                resolvedRequestBodySchema?.description ||
                parameterSchemas?.find((x) => x?.description)?.description,
            } as JSONSchema7,
          );

          const statusSchema: JSONSchema7 = {
            type: "object",
            required: ["status"],
            properties: {
              status: {
                type: "number",
                enum: statusCodes.map((x) => Number(x)),
              },
              statusDescription: { type: "string" },
              statusText: { type: "string" },
            },
          };

          const mergedOutputSchema = [
            ...responseStatusSchemas.map((x) => x.mergedSchema),
            statusSchema,
          ].reduce(
            (accumulator, next) => {
              // NB: This assumes body and parameters have no overlapping naming!
              return {
                ...accumulator,
                properties: {
                  ...accumulator.properties,
                  ...next.properties,
                },
                required: (accumulator.required || []).concat(
                  next.required || [],
                ),
              };
            },
            {
              type: "object",
              properties: {},
              required: [],
              additionalProperties: false,
              description: bestStatusResponse?.description
                ? `${bestStatusResponse.status}: ${bestStatusResponse.description}\n\n${bestStatusResponse?.mergedSchema?.description}`
                : undefined,
            } as JSONSchema7,
          );

          const neededRefs = findRefs(
            { mergedInputSchema, mergedOutputSchema },
            openapi.components?.schemas,
          );

          // console.log({ neededRefs });

          const definitions = neededRefs.reduce((previous, refName) => {
            const theRef = openapi.components?.schemas?.[refName] as
              | JSONSchema7
              | undefined;

            const ref = theRef
              ? renameRefs(theRef, "jsonschema")
              : ({
                  description: "Reference couldn't be found",
                } as JSONSchema7);

            return {
              ...previous,
              [refName]: ref,
            };
          }, {} as { [key: string]: JSONSchema7 });

          const realMergedInputSchema =
            !mergedInputSchema.properties ||
            Object.keys(mergedInputSchema.properties).length === 0
              ? undefined
              : mergedInputSchema;
          const realMergedOutputSchema =
            !mergedOutputSchema.properties ||
            Object.keys(mergedOutputSchema.properties).length === 0
              ? undefined
              : mergedOutputSchema;

          const parsedOperation: ParsedOperation = {
            openapiUrl,
            operationId,
            openapiId,
            path,
            serversWithOrigin,
            method: method as HttpMethodEnum,
            operation,
            parameters,
            responseStatusSchemas,
            resolvedRequestBodySchema,
            // these have definitions
            mergedInputSchema: realMergedInputSchema,
            mergedOutputSchema: realMergedOutputSchema,
            definitions,
          };
          return parsedOperation;
        })
        .filter(notEmpty);

      return pathMethods;
    })
    .filter(notEmpty)
    .flat();

  return operations;
};

/** Returns the refs names (without pointer) that are included */
export const findRefs = (
  json: any,
  refs: O | undefined,
  refPrefix = "#/components/schemas/",
) => {
  if (!refs) {
    return [];
  }
  // NB: no spaces!
  const string = JSON.stringify(json, undefined, 0);
  const refsIncluded = Object.keys(refs).filter((refKey) => {
    const snippet = `"$ref":"${refPrefix}${refKey}"`;
    const includesSnippet = string.includes(snippet);
    return includesSnippet;
  });
  return refsIncluded;
};
