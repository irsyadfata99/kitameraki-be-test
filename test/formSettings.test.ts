import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  createDefaultFormSettings,
  MAX_FIELDS,
  saveFormSettingsSchema,
  type FormField,
} from "../src/models/formSettings";

const ORG = randomUUID();

/** A valid layout to mutate: the default form plus one custom email field in its own row. */
function validLayout() {
  const { fields, rows } = createDefaultFormSettings(ORG);
  const custom: FormField = { kind: "custom", id: randomUUID(), label: "Contact", type: "email" };
  return { fields: [...fields, custom], rows: [...rows.map((row) => [...row]), [custom.id]], custom };
}

const parse = (input: unknown) => saveFormSettingsSchema.safeParse(input);
const messages = (input: unknown): string[] => {
  const result = parse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("saveFormSettingsSchema", () => {
  it("accepts the default layout", () => {
    const { fields, rows } = createDefaultFormSettings(ORG);
    assert.equal(parse({ fields, rows }).success, true);
  });

  it("accepts custom fields of every type", () => {
    const { fields, rows } = validLayout();
    const extra = (["text", "date", "datetime", "email"] as const).map((type) => ({
      kind: "custom" as const,
      id: randomUUID(),
      label: type,
      type,
    }));
    assert.equal(
      parse({ fields: [...fields, ...extra], rows: [...rows, ...extra.map((f) => [f.id])] }).success,
      true,
    );
  });

  it("allows built-in fields to be renamed", () => {
    const { fields, rows } = validLayout();
    const renamed = fields.map((f) => (f.id === "title" ? { ...f, label: "Name" } : f));
    assert.equal(parse({ fields: renamed, rows }).success, true);
  });

  it("rejects removing a built-in field", () => {
    const { fields, rows } = validLayout();
    const without = fields.filter((f) => f.id !== "tags");
    const layoutRows = rows.map((row) => row.filter((id) => id !== "tags")).filter((r) => r.length > 0);
    assert.ok(messages({ fields: without, rows: layoutRows }).some((m) => m.includes('"tags" cannot be removed')));
  });

  it("rejects more than 2 columns in a row", () => {
    const { fields, rows } = validLayout();
    assert.equal(parse({ fields, rows: [["title", "description", "status"], ...rows.slice(1)] }).success, false);
  });

  it("rejects an empty row", () => {
    const { fields, rows } = validLayout();
    assert.equal(parse({ fields, rows: [...rows, []] }).success, false);
  });

  it("rejects a field that is not placed in any row", () => {
    const { fields, rows, custom } = validLayout();
    const layoutRows = rows.filter((row) => !row.includes(custom.id));
    assert.ok(messages({ fields, rows: layoutRows }).some((m) => m.includes("is not placed in any row")));
  });

  it("rejects a field placed twice", () => {
    const { fields, rows, custom } = validLayout();
    assert.ok(messages({ fields, rows: [...rows, [custom.id]] }).some((m) => m.includes("placed more than once")));
  });

  it("rejects a row that points to an unknown field", () => {
    const { fields, rows } = validLayout();
    assert.ok(messages({ fields, rows: [...rows, [randomUUID()]] }).some((m) => m.includes("Unknown field id")));
  });

  it("rejects duplicate field ids", () => {
    const { fields, rows, custom } = validLayout();
    assert.ok(messages({ fields: [...fields, custom], rows }).some((m) => m.includes("Duplicate field id")));
  });

  it("rejects a custom field with a non-uuid id, an empty label or an unknown type", () => {
    const { fields, rows, custom } = validLayout();
    const withCustom = (patch: object) => ({
      fields: fields.map((f) => (f.id === custom.id ? { ...f, ...patch } : f)),
      rows,
    });
    assert.equal(parse(withCustom({ id: "not-a-uuid" })).success, false);
    assert.equal(parse(withCustom({ label: "   " })).success, false);
    assert.equal(parse(withCustom({ type: "number" })).success, false);
  });

  it("rejects unknown properties (strict) such as organizationId", () => {
    const { fields, rows } = validLayout();
    assert.equal(parse({ fields, rows, organizationId: randomUUID() }).success, false);
  });

  it("caps the number of fields", () => {
    const { fields, rows } = createDefaultFormSettings(ORG);
    const extra = Array.from({ length: MAX_FIELDS }, () => ({
      kind: "custom" as const,
      id: randomUUID(),
      label: "x",
      type: "text" as const,
    }));
    assert.equal(
      parse({ fields: [...fields, ...extra], rows: [...rows, ...extra.map((f) => [f.id])] }).success,
      false,
    );
  });
});

describe("createDefaultFormSettings", () => {
  it("belongs to the given organization and places every built-in field exactly once", () => {
    const settings = createDefaultFormSettings(ORG);
    assert.equal(settings.organizationId, ORG);
    assert.deepEqual([...settings.rows.flat()].sort(), settings.fields.map((f) => f.id).sort());
  });
});
