/** Minimal Zod-to-JSON-Schema converter for MCP input schemas. */
import { z } from "zod";

interface ZodInternal {
  _def?: {
    typeName?: string;
    shape?: () => Record<string, z.ZodTypeAny>;
    type?: z.ZodTypeAny;
    innerType?: z.ZodTypeAny;
    description?: string;
    values?: string[];
    value?: unknown;
    defaultValue?: () => unknown;
  };
  isOptional?: () => boolean;
}

export function zodToJsonSchema(schema: z.ZodTypeAny): unknown {
  const zodType = schema as unknown as ZodInternal;
  if (zodType._def?.typeName !== "ZodObject" || !zodType._def.shape) return {};

  const shape = zodType._def.shape();
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, value] of Object.entries(shape)) {
    properties[key] = zodTypeToJson(value);
    if (isRequired(value)) required.push(key);
  }
  return { type: "object", properties, required };
}

function isRequired(schema: z.ZodTypeAny): boolean {
  const def = (schema as unknown as ZodInternal)._def;
  if (def?.typeName === "ZodOptional" || def?.typeName === "ZodDefault") return false;
  return !(schema as unknown as ZodInternal).isOptional?.();
}

function zodTypeToJson(schema: z.ZodTypeAny): unknown {
  const def = (schema as unknown as ZodInternal)._def;
  const typeName = def?.typeName || "";
  const withDescription = (json: Record<string, unknown>) => {
    if (def?.description) json.description = def.description;
    return json;
  };

  const scalar = scalarZodTypeToJson(typeName, def);
  if (scalar) return withDescription(scalar);
  if (typeName === "ZodArray") return withDescription({ type: "array", items: def?.type ? zodTypeToJson(def.type) : {} });
  if (typeName === "ZodOptional") return def?.innerType ? withDescription(zodTypeToJson(def.innerType) as Record<string, unknown>) : {};
  if (typeName === "ZodDefault") return zodDefaultToJson(def, withDescription);
  if (typeName === "ZodNullable") return zodNullableToJson(def, withDescription);
  if (typeName === "ZodObject") return zodToJsonSchema(schema);
  return withDescription({});
}

function scalarZodTypeToJson(typeName: string, def: ZodInternal["_def"]): Record<string, unknown> | null {
  if (typeName === "ZodString") return { type: "string" };
  if (typeName === "ZodNumber") return { type: "number" };
  if (typeName === "ZodBoolean") return { type: "boolean" };
  if (typeName === "ZodEnum") return { type: "string", enum: def?.values || [] };
  if (typeName === "ZodLiteral") return { const: def?.value, type: typeof def?.value };
  return null;
}

function zodDefaultToJson(def: ZodInternal["_def"], withDescription: (json: Record<string, unknown>) => Record<string, unknown>): unknown {
  const json = def?.innerType ? (zodTypeToJson(def.innerType) as Record<string, unknown>) : {};
  if (def?.defaultValue) json.default = def.defaultValue();
  return withDescription(json);
}

function zodNullableToJson(def: ZodInternal["_def"], withDescription: (json: Record<string, unknown>) => Record<string, unknown>): unknown {
  const json = def?.innerType ? (zodTypeToJson(def.innerType) as Record<string, unknown>) : {};
  json.nullable = true;
  return withDescription(json);
}
