import { z } from "zod";

export const fieldTypes = ["TEXT", "NUMBER", "SELECT", "MULTI_SELECT", "DATE", "FILE", "BOOLEAN"] as const;

export const slugSchema = z.string().min(2).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const createTenantSchema = z.object({
  name: z.string().min(2),
  slug: slugSchema,
  metadata: z.record(z.unknown()).optional(),
});

export const createFormSchema = z.object({
  name: z.string().min(2),
  slug: slugSchema,
  description: z.string().optional(),
  fields: z.array(
    z.object({
      key: slugSchema,
      label: z.string().min(1),
      type: z.enum(fieldTypes),
      required: z.boolean().optional(),
      position: z.number().int().nonnegative(),
      placeholder: z.string().optional(),
      helpText: z.string().optional(),
      config: z.record(z.unknown()).optional(),
      condition: z
        .object({
          fieldKey: z.string().min(1),
          operator: z.enum(["equals", "notEquals", "in", "exists"]),
          value: z.unknown().optional(),
        })
        .nullable()
        .optional(),
      options: z
        .array(
          z.object({
            label: z.string().min(1),
            value: z.string().min(1),
            position: z.number().int().nonnegative(),
            metadata: z.record(z.unknown()).optional(),
          }),
        )
        .optional(),
    }),
  ).min(1),
});

export const submitFormSchema = z.object({
  values: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
});

export type PublicField = {
  id: string;
  key: string;
  type: (typeof fieldTypes)[number];
  required: boolean;
  condition: unknown;
  options: Array<{ value: string }>;
};

export function validateSubmission(fields: PublicField[], values: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  const normalized: Array<{ fieldId: string; value: unknown }> = [];

  for (const field of fields) {
    if (!conditionMatches(field.condition, values)) {
      continue;
    }

    const value = values[field.key];
    const empty = value === undefined || value === null || value === "";

    if (field.required && empty) {
      errors[field.key] = "Campo obrigatorio.";
      continue;
    }

    if (empty) {
      continue;
    }

    const parsed = parseFieldValue(field, value);
    if (!parsed.ok) {
      errors[field.key] = parsed.error;
      continue;
    }

    normalized.push({ fieldId: field.id, value: parsed.value });
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false as const, errors };
  }

  return { ok: true as const, values: normalized };
}

function conditionMatches(condition: unknown, values: Record<string, unknown>) {
  if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
    return true;
  }

  const rule = condition as { fieldKey?: string; operator?: string; value?: unknown };
  const current = rule.fieldKey ? values[rule.fieldKey] : undefined;

  if (rule.operator === "exists") {
    return current !== undefined && current !== null && current !== "";
  }

  if (rule.operator === "equals") {
    return current === rule.value;
  }

  if (rule.operator === "notEquals") {
    return current !== rule.value;
  }

  if (rule.operator === "in") {
    return Array.isArray(rule.value) && rule.value.includes(current);
  }

  return true;
}

function parseFieldValue(field: PublicField, value: unknown) {
  const options = new Set(field.options.map((option) => option.value));

  switch (field.type) {
    case "TEXT":
      return typeof value === "string"
        ? { ok: true as const, value: value.trim() }
        : { ok: false as const, error: "Texto invalido." };
    case "NUMBER": {
      const numberValue = typeof value === "number" ? value : Number(value);
      return Number.isFinite(numberValue)
        ? { ok: true as const, value: numberValue }
        : { ok: false as const, error: "Numero invalido." };
    }
    case "SELECT":
      return typeof value === "string" && options.has(value)
        ? { ok: true as const, value }
        : { ok: false as const, error: "Opcao invalida." };
    case "MULTI_SELECT":
      return Array.isArray(value) && value.every((item) => typeof item === "string" && options.has(item))
        ? { ok: true as const, value }
        : { ok: false as const, error: "Opcoes invalidas." };
    case "DATE":
      return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
        ? { ok: true as const, value }
        : { ok: false as const, error: "Data invalida. Use YYYY-MM-DD." };
    case "FILE":
      return isFileReference(value)
        ? { ok: true as const, value }
        : { ok: false as const, error: "Arquivo invalido." };
    case "BOOLEAN":
      return typeof value === "boolean"
        ? { ok: true as const, value }
        : { ok: false as const, error: "Booleano invalido." };
  }
}

function isFileReference(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const file = value as Record<string, unknown>;
  return typeof file.storageKey === "string" && typeof file.fileName === "string";
}
