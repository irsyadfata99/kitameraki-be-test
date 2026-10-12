import { z } from "zod";
import { badRequest } from "../lib/errors";
import { CustomFieldType, FormField } from "../models/formSettings";
import { getFormSettings } from "../repositories/formSettingsRepository";

const VALUE_SCHEMAS: Record<CustomFieldType, z.ZodTypeAny> = {
  text: z.string().max(1000),
  date: z.string().date(),
  datetime: z.string().datetime({ offset: true }),
  email: z.string().email().max(254),
};

export interface CustomFieldIssue {
  path: string;
  message: string;
}

export function validateCustomFieldValues(
  fields: FormField[],
  values: Record<string, string>,
): CustomFieldIssue[] {
  const typeById = new Map<string, CustomFieldType>();
  for (const field of fields) {
    if (field.kind === "custom") typeById.set(field.id, field.type);
  }

  const issues: CustomFieldIssue[] = [];
  for (const [fieldId, value] of Object.entries(values)) {
    const path = `customFields.${fieldId}`;
    const type = typeById.get(fieldId);
    if (!type) {
      issues.push({ path, message: "Unknown custom field" });
      continue;
    }
    if (value === "") continue;
    if (!VALUE_SCHEMAS[type].safeParse(value).success) {
      issues.push({ path, message: `Invalid ${type} value` });
    }
  }
  return issues;
}

export async function assertValidCustomFields(
  organizationId: string,
  values: Record<string, string> | undefined,
): Promise<void> {
  if (!values || Object.keys(values).length === 0) return;

  const settings = await getFormSettings(organizationId);
  const issues = validateCustomFieldValues(settings.fields, values);
  if (issues.length > 0) throw badRequest("Validation failed", issues);
}
