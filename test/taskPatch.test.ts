import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPatchOperations, clearsValues } from "../src/lib/taskPatch";

describe("clearsValues", () => {
  it("is true only when a value is null", () => {
    assert.equal(clearsValues({ dueDate: null }), true);
    assert.equal(clearsValues({ title: "a", priority: null }), true);
    assert.equal(clearsValues({ title: "a" }), false);
  });
});

describe("buildPatchOperations", () => {
  it("sets every provided value", () => {
    assert.deepEqual(buildPatchOperations({ title: "New", status: "completed" }), [
      { op: "set", path: "/title", value: "New" },
      { op: "set", path: "/status", value: "completed" },
    ]);
  });

  it("replaces a whole value such as tags or customFields", () => {
    assert.deepEqual(buildPatchOperations({ tags: [] }), [{ op: "set", path: "/tags", value: [] }]);
  });

  it("removes a cleared property that is stored", () => {
    const existing = { id: "1", dueDate: "2026-10-12T00:00:00.000Z", priority: "high" };
    assert.deepEqual(buildPatchOperations({ dueDate: null, priority: null }, existing), [
      { op: "remove", path: "/dueDate" },
      { op: "remove", path: "/priority" },
    ]);
  });

  it("skips clearing a property that is not stored (Cosmos would reject the remove)", () => {
    assert.deepEqual(buildPatchOperations({ dueDate: null }, { id: "1" }), []);
  });

  it("mixes sets and removals", () => {
    assert.deepEqual(buildPatchOperations({ title: "x", priority: null }, { priority: "low" }), [
      { op: "set", path: "/title", value: "x" },
      { op: "remove", path: "/priority" },
    ]);
  });

  it("ignores undefined values", () => {
    assert.deepEqual(buildPatchOperations({ title: undefined, status: "todo" }), [
      { op: "set", path: "/status", value: "todo" },
    ]);
  });
});
