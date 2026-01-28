export type JSONSchema = {
  type?: string;
  properties?: { [key: string]: JSONSchema };
  items?: JSONSchema;
  required?: string[];
  enum?: any[];
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  $ref?: string;
  nullable?: boolean;
  description?: string;
};

export interface Parameter {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  required?: boolean;
  schema?: {
    type: string;
    enum?: string[];
    default?: any;
  };
  description?: string;
}

export interface RequestBody {
  required?: boolean;
  content: {
    [key: string]: {
      schema: any;
    };
  };
}

export interface Operation {
  operationId?: string;
  servers?: Server[];
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  tags: any;
  responses: {
    [key: string]: any;
  };
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
}
export type Server = { url: string; description?: string };
export interface OpenapiDocument {
  tags?: any;
  components?: any;
  webhooks?: any;
  openapi?: string;
  servers?: Server[];
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: {
    [key: string]: PathItem;
  };
}

export type SchemaObject = {
  type: string;
  pattern?: string;
  properties?: { [key: string]: SchemaObject };
  items?: SchemaObject;
  required?: string[];
  enum?: any[];
  description?: string;
  format?: string;
  default?: any;
} & { [key: string]: any };
