import type { SortField, TaskPriority, TaskStatus } from "../models/task";

/**
 * Only what is needed to order tasks. Loading just these (instead of whole documents,
 * which can hold large custom field values) keeps the in-memory sort cheap.
 */
export interface TaskSortKeys {
  id: string;
  title: string;
  dueDate?: string;
  priority?: TaskPriority;
  status: TaskStatus;
  /** Cosmos system timestamp (seconds). Stands in for "created at". */
  _ts: number;
}

export const SORT_KEY_PROJECTION = "c.id, c.title, c.dueDate, c.priority, c.status, c._ts";

// Logical order, not alphabetical: "high" < "low" < "medium" would be wrong.
const PRIORITY_RANK: Record<TaskPriority, number> = { low: 1, medium: 2, high: 3 };
const STATUS_RANK: Record<TaskStatus, number> = { todo: 1, "in-progress": 2, completed: 3 };

// Case-insensitive, and "Task 2" comes before "Task 10".
const TITLE_COLLATOR = new Intl.Collator("en", { sensitivity: "base", numeric: true });

type SortValue = string | number | undefined;

function sortValue(task: TaskSortKeys, sortBy: SortField): SortValue {
  switch (sortBy) {
    case "title":
      return task.title;
    case "dueDate": {
      // Compare instants, not strings: "+07:00" and "Z" offsets do not sort correctly as text.
      const instant = task.dueDate ? Date.parse(task.dueDate) : Number.NaN;
      return Number.isNaN(instant) ? undefined : instant;
    }
    case "priority":
      return task.priority ? PRIORITY_RANK[task.priority] : undefined;
    case "status":
      return STATUS_RANK[task.status];
    case "createdAt":
      return task._ts;
  }
}

/**
 * Comparator for the chosen field and direction.
 * - A task without a value always goes last, in both directions.
 * - Ties fall back to newest first, then id, so a task never jumps between pages.
 */
export function compareTasks(sortBy: SortField, order: "asc" | "desc") {
  const direction = order === "asc" ? 1 : -1;

  return (a: TaskSortKeys, b: TaskSortKeys): number => {
    const x = sortValue(a, sortBy);
    const y = sortValue(b, sortBy);

    if (x === undefined && y !== undefined) return 1;
    if (x !== undefined && y === undefined) return -1;
    if (x !== undefined && y !== undefined) {
      const result =
        typeof x === "string" && typeof y === "string"
          ? TITLE_COLLATOR.compare(x, y)
          : Number(x) - Number(y);
      if (result !== 0) return result * direction;
    }

    if (a._ts !== b._ts) return b._ts - a._ts;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}

/** Ids of the tasks on the requested page, after sorting. */
export function pageOfSortedIds(
  keys: TaskSortKeys[],
  sortBy: SortField,
  order: "asc" | "desc",
  page: number,
  pageSize: number,
): string[] {
  const start = (page - 1) * pageSize;
  return [...keys]
    .sort(compareTasks(sortBy, order))
    .slice(start, start + pageSize)
    .map((task) => task.id);
}
