import { AI_LESSON_JSON_SCHEMA } from "./lesson-generation-prompt";

interface SchemaNode {
  [key: string]: unknown;
  type?: string | string[]; const?: unknown; enum?: unknown[]; properties?: Record<string, SchemaNode>;
  required?: string[]; anyOf?: SchemaNode[]; oneOf?: SchemaNode[]; allOf?: SchemaNode[]; items?: SchemaNode;
}
function intersect(a: SchemaNode, b: SchemaNode): SchemaNode {
  if (a.anyOf) return { anyOf: a.anyOf.map((v) => intersect(v, b)) };
  if (b.anyOf) return { anyOf: b.anyOf.map((v) => intersect(a, v)) };
  const properties = { ...a.properties, ...b.properties };
  for (const key of Object.keys(a.properties ?? {})) {
    if (b.properties?.[key]) properties[key] = intersect(a.properties![key], b.properties[key]);
  }
  return { ...a, ...b, ...(a.properties || b.properties ? { properties, required: [...new Set([...(a.required ?? []), ...(b.required ?? [])])] } : {}) };
}
function flatten(node: SchemaNode): SchemaNode {
  const { allOf, oneOf, ...base } = node;
  const rest = oneOf ? { ...base, anyOf: oneOf } : base;
  let result = allOf ? allOf.map(flatten).reduce(intersect, rest) : rest;
  if (result.properties) result = { ...result, properties: Object.fromEntries(Object.entries(result.properties).map(([k, v]) => [k, flatten(v)])) };
  if (result.anyOf) result = { ...result, anyOf: result.anyOf.map(flatten) };
  if (result.items) result = { ...result, items: flatten(result.items) };
  return result;
}
const source = flatten(AI_LESSON_JSON_SCHEMA as SchemaNode);
function strictWire(node: SchemaNode): SchemaNode {
  // Keep only the supported structural subset. Domain limits/refinements remain in Zod.
  const result: SchemaNode = {};
  if (node.type) result.type = node.type;
  if (node.enum) result.enum = node.enum;
  if (node.const !== undefined) result.enum = [node.const];
  if (node.anyOf) result.anyOf = node.anyOf.map(strictWire);
  if (node.items) result.items = strictWire(node.items);
  if (node.type === "object" || node.properties) {
    result.type = "object";
    result.properties = Object.fromEntries(Object.entries(node.properties ?? {}).map(([key, value]) => [key,
      node.required?.includes(key) || acceptsNull(value) ? strictWire(value) : { anyOf: [strictWire(value), { type: "null" }] },
    ]));
    result.required = Object.keys(result.properties);
    result.additionalProperties = false;
  }
  return result;
}
export const AI_PROVIDER_OUTPUT_SCHEMA = strictWire(source);
function acceptsNull(node: SchemaNode): boolean {
  return node.type === "null" || Array.isArray(node.type) && node.type.includes("null") || !!node.anyOf?.some(acceptsNull);
}
function branch(node: SchemaNode, value: unknown): SchemaNode {
  if (!node.anyOf) return node;
  const object = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  return node.anyOf.find((v) => object && v.properties?.type?.const === object.type)
    ?? node.anyOf.find((v) => value === null ? acceptsNull(v) : v.type === (Array.isArray(value) ? "array" : typeof value))
    ?? node.anyOf[0];
}
/** Translate only the wire encoding of absent optional fields; never repair content. */
export function decodeProviderOptionalFields(value: unknown, schema: SchemaNode = source): unknown {
  const selected = branch(schema, value);
  if (Array.isArray(value)) return value.map((v) => selected.items ? decodeProviderOptionalFields(v, selected.items) : v);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key, v]) => !(v === null && selected.properties?.[key] && !selected.required?.includes(key) && !acceptsNull(selected.properties[key])))
    .map(([key, v]) => [key, selected.properties?.[key] ? decodeProviderOptionalFields(v, selected.properties[key]) : v]));
}
