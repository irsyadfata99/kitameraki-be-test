import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareTasks, pageOfSortedIds, type TaskSortKeys } from "../src/lib/taskSort";

let counter = 0;
function task(fields: Partial<TaskSortKeys> & { id: string }): TaskSortKeys {
  counter += 1;
  return { title: `Task ${fields.id}`, status: "todo", _ts: 1000 + counter, ...fields };
}

const ids = (list: TaskSortKeys[], sortBy: Parameters<typeof compareTasks>[0], order: "asc" | "desc") =>
  [...list].sort(compareTasks(sortBy, order)).map((t) => t.id);

describe("compareTasks", () => {
  it("puts tasks without a value last, in both directions (the original bug)", () => {
    const list = [
      task({ id: "none" }),
      task({ id: "late", dueDate: "2026-12-01T00:00:00.000Z" }),
      task({ id: "soon", dueDate: "2026-10-01T00:00:00.000Z" }),
    ];
    assert.deepEqual(ids(list, "dueDate", "asc"), ["soon", "late", "none"]);
    assert.deepEqual(ids(list, "dueDate", "desc"), ["late", "soon", "none"]);
  });

  it("keeps every task: nothing is dropped when the field is missing", () => {
    const list = [task({ id: "a" }), task({ id: "b" }), task({ id: "c", priority: "low" })];
    assert.equal(ids(list, "priority", "asc").length, 3);
  });

  it("sorts priority logically (low < medium < high), not alphabetically", () => {
    const list = [
      task({ id: "m", priority: "medium" }),
      task({ id: "h", priority: "high" }),
      task({ id: "l", priority: "low" }),
      task({ id: "n" }),
    ];
    assert.deepEqual(ids(list, "priority", "asc"), ["l", "m", "h", "n"]);
    assert.deepEqual(ids(list, "priority", "desc"), ["h", "m", "l", "n"]);
  });

  it("sorts status in workflow order", () => {
    const list = [
      task({ id: "done", status: "completed" }),
      task({ id: "todo", status: "todo" }),
      task({ id: "doing", status: "in-progress" }),
    ];
    assert.deepEqual(ids(list, "status", "asc"), ["todo", "doing", "done"]);
  });

  it("sorts titles ignoring case and comparing numbers naturally", () => {
    const list = [
      task({ id: "1", title: "task 10" }),
      task({ id: "2", title: "Banana" }),
      task({ id: "3", title: "Task 2" }),
      task({ id: "4", title: "apple" }),
    ];
    assert.deepEqual(ids(list, "title", "asc"), ["4", "2", "3", "1"]);
  });

  it("compares due dates as instants, not as text, across time zones", () => {
    const list = [
      // 09:00 +07:00 is 02:00Z, which is EARLIER than 05:00Z although "09" > "05" as text.
      task({ id: "plus7", dueDate: "2026-10-20T09:00:00+07:00" }),
      task({ id: "utc", dueDate: "2026-10-20T05:00:00Z" }),
    ];
    assert.deepEqual(ids(list, "dueDate", "asc"), ["plus7", "utc"]);
  });

  it("breaks ties newest first, then by id, so order is deterministic", () => {
    const list = [
      task({ id: "b", priority: "high", _ts: 10 }),
      task({ id: "a", priority: "high", _ts: 10 }),
      task({ id: "c", priority: "high", _ts: 20 }),
    ];
    assert.deepEqual(ids(list, "priority", "asc"), ["c", "a", "b"]);
    assert.deepEqual(ids(list, "priority", "desc"), ["c", "a", "b"]);
  });

  it("sorts by creation time using the system timestamp", () => {
    const list = [task({ id: "old", _ts: 1 }), task({ id: "new", _ts: 9 })];
    assert.deepEqual(ids(list, "createdAt", "desc"), ["new", "old"]);
    assert.deepEqual(ids(list, "createdAt", "asc"), ["old", "new"]);
  });
});

describe("pageOfSortedIds", () => {
  const list = Array.from({ length: 7 }, (_, i) =>
    task({ id: `t${i + 1}`, title: `Task ${i + 1}`, ...(i % 2 === 0 ? { priority: "low" as const } : {}) }),
  );

  it("pages the sorted result and never repeats or loses a task", () => {
    const pages = [1, 2, 3].flatMap((page) => pageOfSortedIds(list, "priority", "asc", page, 3));
    assert.equal(pages.length, 7);
    assert.equal(new Set(pages).size, 7);
  });

  it("returns an empty page past the end", () => {
    assert.deepEqual(pageOfSortedIds(list, "title", "asc", 5, 3), []);
  });

  it("does not modify the input array", () => {
    const copy = list.map((t) => t.id);
    pageOfSortedIds(list, "title", "desc", 1, 3);
    assert.deepEqual(list.map((t) => t.id), copy);
  });
});
