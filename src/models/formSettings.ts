import { z } from "zod";

export const BUILT_IN_FIELD_IDS = [
  "title",
  "description",
  "dueDate",
  "priority",
  "status",
  "tags",
] as const;
export const CUSTOM_FIELD_TYPES = [
  "text",
  "date",
  "datetime",
  "email",
] as const;

export const MAX_COLUMNS = 2;

export const MAX_FIELDS = 100;

export type BuiltInFieldId = (typeof BUILT_IN_FIELD_IDS)[number];
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export interface BuiltInField {
  kind: "builtIn";
  id: BuiltInFieldId;
  label: string;
}

export interface CustomField {
  kind: "custom";
  id: string;
  label: string;
  type: CustomFieldType;
}

export type FormField = BuiltInField | CustomField;

export interface FormSettings {
  organizationId: string;

  fields: FormField[];

  rows: string[][];
  updatedAt?: string;
}

const uuid = z.string().uuid();
const label = z.string().trim().min(1).max(100);

const builtInFieldSchema = z
  .object({
    kind: z.literal("builtIn"),
    id: z.enum(BUILT_IN_FIELD_IDS),
    label,
  })
  .strict();

const customFieldSchema = z
  .object({
    kind: z.literal("custom"),
    id: uuid,
    label,
    type: z.enum(CUSTOM_FIELD_TYPES),
  })
  .strict();

const fieldSchema = z.discriminatedUnion("kind", [
  builtInFieldSchema,
  customFieldSchema,
]);

interface LayoutInput {
  fields: z.infer<typeof fieldSchema>[];
  rows: string[][];
}

function validateLayout(value: LayoutInput, ctx: z.RefinementCtx): void {
  const fieldIds = new Set<string>();
  value.fields.forEach((field, index) => {
    if (fieldIds.has(field.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fields", index, "id"],
        message: "Duplicate field id",
      });
    }
    fieldIds.add(field.id);
  });

  for (const builtIn of BUILT_IN_FIELD_IDS) {
    if (!fieldIds.has(builtIn)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fields"],
        message: `Built-in field "${builtIn}" cannot be removed`,
      });
    }
  }

  const placed = new Map<string, number>();
  value.rows.forEach((row, rowIndex) => {
    row.forEach((fieldId, columnIndex) => {
      if (!fieldIds.has(fieldId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rows", rowIndex, columnIndex],
          message: `Unknown field id "${fieldId}"`,
        });
      }
      placed.set(fieldId, (placed.get(fieldId) ?? 0) + 1);
    });
  });

  for (const fieldId of fieldIds) {
    const count = placed.get(fieldId) ?? 0;
    if (count !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rows"],
        message:
          count === 0
            ? `Field "${fieldId}" is not placed in any row`
            : `Field "${fieldId}" is placed more than once`,
      });
    }
  }
}

export const saveFormSettingsSchema = z
  .object({
    fields: z.array(fieldSchema).max(MAX_FIELDS),
    rows: z
      .array(z.array(z.string().min(1)).min(1).max(MAX_COLUMNS))
      .max(MAX_FIELDS),
  })
  .strict()
  .superRefine(validateLayout);

export type SaveFormSettingsInput = z.infer<typeof saveFormSettingsSchema>;

export function createDefaultFormSettings(
  organizationId: string,
): FormSettings {
  const labels: Record<BuiltInFieldId, string> = {
    title: "Title",
    description: "Description",
    dueDate: "Due date",
    priority: "Priority",
    status: "Status",
    tags: "Tags",
  };
  return {
    organizationId,
    fields: BUILT_IN_FIELD_IDS.map((id) => ({
      kind: "builtIn" as const,
      id,
      label: labels[id],
    })),
    rows: [
      ["title"],
      ["description"],
      ["dueDate", "priority"],
      ["status", "tags"],
    ],
  };
}
