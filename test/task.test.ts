import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  bulkDeleteSchema,
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskSchema,
} from "../src/models/task";

describe("createTaskSchema", () => {
  it("defaults the status to todo", () => {
    const result = createTaskSchema.parse({ title: "  Write docs " });
    assert.equal(result.title, "Write docs");
    assert.equal(result.status, "todo");
  });

  it("rejects an empty title, a bad status and a bad due date", () => {
    assert.equal(createTaskSchema.safeParse({ title: "  " }).success, false);
    assert.equal(createTaskSchema.safeParse({ title: "a", status: "done" }).success, false);
    assert.equal(createTaskSchema.safeParse({ title: "a", dueDate: "2026-10-12" }).success, false);
  });

  it("rejects organizationId in the body (tenant comes from the header only)", () => {
    assert.equal(createTaskSchema.safeParse({ title: "a", organizationId: randomUUID() }).success, false);
  });

  it("rejects null on create (null only means 'clear' in a PATCH)", () => {
    assert.equal(createTaskSchema.safeParse({ title: "a", dueDate: null }).success, false);
  });

  it("limits custom field keys to uuids", () => {
    assert.equal(createTaskSchema.safeParse({ title: "a", customFields: { title: "x" } }).success, false);
    assert.equal(createTaskSchema.safeParse({ title: "a", customFields: { [randomUUID()]: "x" } }).success, true);
  });
});

describe("updateTaskSchema", () => {
  it("requires at least one field", () => {
    assert.equal(updateTaskSchema.safeParse({}).success, false);
  });

  it("accepts a partial update", () => {
    assert.equal(updateTaskSchema.safeParse({ status: "completed" }).success, true);
  });

  it("accepts null to clear dueDate and priority", () => {
    assert.deepEqual(updateTaskSchema.parse({ dueDate: null, priority: null }), { dueDate: null, priority: null });
  });

  it("does not accept null for required or other fields", () => {
    assert.equal(updateTaskSchema.safeParse({ title: null }).success, false);
    assert.equal(updateTaskSchema.safeParse({ status: null }).success, false);
    assert.equal(updateTaskSchema.safeParse({ tags: null }).success, false);
  });

  it("never allows id or organizationId to change", () => {
    assert.equal(updateTaskSchema.safeParse({ id: randomUUID() }).success, false);
    assert.equal(updateTaskSchema.safeParse({ organizationId: randomUUID() }).success, false);
  });
});

describe("bulkDeleteSchema", () => {
  it("needs 1 to 100 uuids", () => {
    assert.equal(bulkDeleteSchema.safeParse({ ids: [] }).success, false);
    assert.equal(bulkDeleteSchema.safeParse({ ids: ["x"] }).success, false);
    assert.equal(bulkDeleteSchema.safeParse({ ids: [randomUUID()] }).success, true);
    assert.equal(bulkDeleteSchema.safeParse({ ids: Array.from({ length: 101 }, () => randomUUID()) }).success, false);
  });
});

describe("listTasksQuerySchema", () => {
  it("applies defaults", () => {
    assert.deepEqual(listTasksQuerySchema.parse({}), {
      page: 1,
      pageSize: 10,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });

  it("treats empty filter params as not set", () => {
    const query = listTasksQuerySchema.parse({ status: "", priority: "", search: "", tag: "" });
    assert.equal(query.status, undefined);
    assert.equal(query.search, undefined);
  });

  it("coerces numbers and rejects out-of-range paging", () => {
    assert.equal(listTasksQuerySchema.parse({ page: "3", pageSize: "50" }).page, 3);
    assert.equal(listTasksQuerySchema.safeParse({ page: "0" }).success, false);
    assert.equal(listTasksQuerySchema.safeParse({ pageSize: "101" }).success, false);
  });
});
