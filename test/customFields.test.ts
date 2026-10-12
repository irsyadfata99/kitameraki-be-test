import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { createDefaultFormSettings, type FormField } from "../src/models/formSettings";
import { validateCustomFieldValues } from "../src/services/customFields";

const field = (type: "text" | "date" | "datetime" | "email"): FormField => ({
  kind: "custom",
  id: randomUUID(),
  label: type,
  type,
});

const builtIns = createDefaultFormSettings(randomUUID()).fields;
const [text, date, datetime, email] = [field("text"), field("date"), field("datetime"), field("email")];
const fields = [...builtIns, text, date, datetime, email];

const paths = (values: Record<string, string>) => validateCustomFieldValues(fields, values).map((i) => i.path);

describe("validateCustomFieldValues", () => {
  it("accepts valid values of every type", () => {
    const issues = validateCustomFieldValues(fields, {
      [text.id]: "hello",
      [date.id]: "2026-10-12",
      [datetime.id]: "2026-10-12T08:30:00.000Z",
      [email.id]: "me@example.com",
    });
    assert.deepEqual(issues, []);
  });

  it("accepts a datetime with a timezone offset", () => {
    assert.deepEqual(validateCustomFieldValues(fields, { [datetime.id]: "2026-10-12T15:30:00+07:00" }), []);
  });

  it("rejects values that do not match the field type", () => {
    assert.deepEqual(paths({ [email.id]: "nope" }), [`customFields.${email.id}`]);
    assert.deepEqual(paths({ [date.id]: "12/10/2026" }), [`customFields.${date.id}`]);
    assert.deepEqual(paths({ [datetime.id]: "2026-10-12" }), [`customFields.${datetime.id}`]);
    assert.deepEqual(paths({ [text.id]: "x".repeat(1001) }), [`customFields.${text.id}`]);
  });

  it("allows an empty string (field left blank)", () => {
    assert.deepEqual(paths({ [email.id]: "", [date.id]: "" }), []);
  });

  it("rejects an id that is not a custom field of the form", () => {
    const unknown = randomUUID();
    const issues = validateCustomFieldValues(fields, { [unknown]: "x" });
    assert.deepEqual(issues, [{ path: `customFields.${unknown}`, message: "Unknown custom field" }]);
  });

  it("does not let a built-in field id be used as a custom field", () => {
    assert.deepEqual(paths({ title: "x" }), ["customFields.title"]);
  });

  it("reports every problem, not only the first", () => {
    assert.equal(paths({ [email.id]: "bad", [date.id]: "bad", [randomUUID()]: "x" }).length, 3);
  });
});
