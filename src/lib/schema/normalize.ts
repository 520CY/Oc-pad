import JSON5 from "json5";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface SchemaNode {
  type?: string | string[];
  title?: string;
  description?: string;
  enum?: JsonValue[];
  default?: JsonValue;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode | SchemaNode[];
  additionalProperties?: boolean | SchemaNode;
  required?: string[];
  anyOf?: SchemaNode[];
  oneOf?: SchemaNode[];
  ref?: string;
  $ref?: string;
  [key: string]: unknown;
}

export interface SchemaRoot extends SchemaNode {
  $defs?: Record<string, SchemaNode>;
  definitions?: Record<string, SchemaNode>;
  components?: {
    schemas?: Record<string, SchemaNode>;
  };
}

export type SchemaValueType =
  | "object"
  | "array"
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "unknown";

export function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function ensureObject(value: JsonValue | undefined): JsonObject {
  if (isJsonObject(value)) {
    return value;
  }
  return {};
}

export function ensureArray(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function parseConfigText(text: string, fallback: JsonObject = {}): JsonObject {
  try {
    const parsed = JSON5.parse(text) as JsonValue;
    return isJsonObject(parsed) ? parsed : cloneJson(fallback);
  } catch {
    return cloneJson(fallback);
  }
}

export function stringifyConfigObject(config: JsonObject): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function resolveSchemaNode(schema: SchemaNode, root: SchemaRoot): SchemaNode {
  let resolved = cloneJson(schema);

  for (let depth = 0; depth < 8; depth += 1) {
    const refToken = typeof resolved.$ref === "string" ? resolved.$ref : typeof resolved.ref === "string" ? resolved.ref : undefined;
    if (!refToken) {
      break;
    }

    const refNode = lookupRef(refToken, root);
    if (!refNode) {
      break;
    }

    const merged = {
      ...cloneJson(refNode),
      ...resolved,
    };
    delete merged.$ref;
    delete merged.ref;
    resolved = merged;
  }

  const unions = resolved.oneOf ?? resolved.anyOf;
  if (Array.isArray(unions) && unions.length > 0) {
    const first = resolveSchemaNode(unions[0], root);
    resolved = {
      ...first,
      ...resolved,
      oneOf: undefined,
      anyOf: undefined,
    };
  }

  return resolved;
}

export function inferSchemaType(schema: SchemaNode, value: JsonValue | undefined): SchemaValueType {
  const candidateType = pickPrimaryType(schema.type);
  if (candidateType) {
    if (candidateType === "integer") {
      return "integer";
    }
    if (
      candidateType === "object" ||
      candidateType === "array" ||
      candidateType === "string" ||
      candidateType === "number" ||
      candidateType === "boolean"
    ) {
      return candidateType;
    }
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const first = schema.enum[0];
    return inferValueType(first);
  }
  if (schema.properties || typeof schema.additionalProperties === "object") {
    return "object";
  }
  if (schema.items) {
    return "array";
  }
  if (value !== undefined) {
    return inferValueType(value);
  }
  return "unknown";
}

export function createDefaultValue(schema: SchemaNode, root: SchemaRoot): JsonValue {
  const resolved = resolveSchemaNode(schema, root);
  if (resolved.default !== undefined) {
    return cloneJson(resolved.default);
  }
  if (Array.isArray(resolved.enum) && resolved.enum.length > 0) {
    return cloneJson(resolved.enum[0]);
  }

  const type = inferSchemaType(resolved, undefined);
  if (type === "object") {
    return {};
  }
  if (type === "array") {
    return [];
  }
  if (type === "number" || type === "integer") {
    return 0;
  }
  if (type === "boolean") {
    return false;
  }
  return "";
}

function lookupRef(refToken: string, root: SchemaRoot): SchemaNode | undefined {
  if (refToken.startsWith("#/")) {
    return lookupJsonPointer(refToken, root);
  }

  if (root.$defs?.[refToken]) {
    return root.$defs[refToken];
  }
  if (root.definitions?.[refToken]) {
    return root.definitions[refToken];
  }
  if (root.components?.schemas?.[refToken]) {
    return root.components.schemas[refToken];
  }
  return undefined;
}

function lookupJsonPointer(pointer: string, target: unknown): SchemaNode | undefined {
  const segments = pointer
    .slice(2)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));

  let current: unknown = target;
  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  if (current && typeof current === "object") {
    return current as SchemaNode;
  }
  return undefined;
}

function pickPrimaryType(type: SchemaNode["type"]): string | undefined {
  if (typeof type === "string") {
    return type;
  }
  if (Array.isArray(type)) {
    return type.find((candidate) => candidate !== "null");
  }
  return undefined;
}

function inferValueType(value: JsonValue): SchemaValueType {
  if (Array.isArray(value)) {
    return "array";
  }
  if (isJsonObject(value)) {
    return "object";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  if (typeof value === "string") {
    return "string";
  }
  return "unknown";
}
